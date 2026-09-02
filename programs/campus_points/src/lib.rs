use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    program::invoke,
    system_instruction,
};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::{
    self,
    spl_token_2022::{
        self,
        extension::ExtensionType,
        instruction::initialize_non_transferable_mint,
    },
    Burn, MintTo, Token2022,
};
use anchor_spl::token_interface::{Mint, TokenAccount};

declare_id!("53sEPq9sSPaaYHYf3MdjMXjqMPpRBLpxTSyWs7EMo5Bb");

#[program]
pub mod campus_points {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let space = ExtensionType::try_calculate_account_len::<spl_token_2022::state::Mint>(&[
            ExtensionType::NonTransferable,
        ])
        .map_err(|_| ErrorCode::CalculationFailure)?;

        let rent_lamports = ctx.accounts.rent.minimum_balance(space);

        invoke(
            &system_instruction::create_account(
                ctx.accounts.authority.key,
                ctx.accounts.mint.key,
                rent_lamports,
                space as u64,
                ctx.accounts.token_2022_program.key,
            ),
            &[
                ctx.accounts.authority.to_account_info(),
                ctx.accounts.mint.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        invoke(
            &initialize_non_transferable_mint(
                ctx.accounts.token_2022_program.key,
                ctx.accounts.mint.key,
            )?,
            &[ctx.accounts.mint.to_account_info()],
        )?;

        invoke(
            &spl_token_2022::instruction::initialize_mint2(
                ctx.accounts.token_2022_program.key,
                ctx.accounts.mint.key,
                &ctx.accounts.campus_config.key(),
                None,
                0,
            )?,
            &[ctx.accounts.mint.to_account_info()],
        )?;

        let config = &mut ctx.accounts.campus_config;
        config.authority = ctx.accounts.authority.key();
        config.mint = ctx.accounts.mint.key();
        config.total_issued = 0;
        config.total_burned = 0;
        config.bump = ctx.bumps.campus_config;

        msg!("CampusConfig initialized with Non-Transferable Mint: {}", config.mint);
        Ok(())
    }

    pub fn register_issuer(
        ctx: Context<RegisterIssuer>,
        daily_limit: u64,
        is_active: bool,
    ) -> Result<()> {
        let issuer = &mut ctx.accounts.issuer_account;
        issuer.authority = ctx.accounts.issuer_authority.key();
        issuer.is_active = is_active;
        issuer.daily_limit = daily_limit;
        issuer.issued_today = 0;
        issuer.last_reset = Clock::get()?.unix_timestamp;
        issuer.bump = ctx.bumps.issuer_account;

        msg!(
            "Issuer registered: {} with daily limit: {}",
            issuer.authority,
            daily_limit
        );
        Ok(())
    }

    pub fn issue_points(ctx: Context<IssuePoints>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let now = Clock::get()?.unix_timestamp;
        let bump = {
            let issuer = &mut ctx.accounts.issuer_account;
            require!(issuer.is_active, ErrorCode::IssuerInactive);

            if now.saturating_sub(issuer.last_reset) >= 86400 {
                issuer.issued_today = 0;
                issuer.last_reset = now;
            }

            let new_issued_today = issuer
                .issued_today
                .checked_add(amount)
                .ok_or(ErrorCode::MathOverflow)?;

            require!(
                new_issued_today <= issuer.daily_limit,
                ErrorCode::DailyLimitExceeded
            );

            issuer.issued_today = new_issued_today;

            let config = &mut ctx.accounts.campus_config;
            config.total_issued = config
                .total_issued
                .checked_add(amount)
                .ok_or(ErrorCode::MathOverflow)?;

            config.bump
        };

        let signer_seeds: &[&[&[u8]]] = &[&[b"config", &[bump]]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: ctx.accounts.campus_config.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_2022_program.key(),
            cpi_accounts,
            signer_seeds,
        );
        token_2022::mint_to(cpi_ctx, amount)?;

        emit!(PointsIssued {
            issuer: ctx.accounts.issuer.key(),
            recipient: ctx.accounts.recipient.key(),
            amount,
            timestamp: now,
        });

        Ok(())
    }

    pub fn create_reward(
        ctx: Context<CreateReward>,
        reward_id: u64,
        cost: u64,
    ) -> Result<()> {
        require!(cost > 0, ErrorCode::InvalidAmount);

        let reward = &mut ctx.accounts.reward;
        reward.reward_id = reward_id;
        reward.cost = cost;
        reward.is_available = true;
        reward.total_redeemed = 0;
        reward.bump = ctx.bumps.reward;

        msg!("Reward created: ID {} with cost {}", reward_id, cost);
        Ok(())
    }

    pub fn redeem_reward(ctx: Context<RedeemReward>, reward_id: u64) -> Result<()> {
        let cost = {
            let reward = &mut ctx.accounts.reward;
            require!(reward.is_available, ErrorCode::RewardUnavailable);
            reward.total_redeemed = reward.total_redeemed.saturating_add(1);
            reward.cost
        };

        let cpi_accounts = Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.student_token_account.to_account_info(),
            authority: ctx.accounts.student.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_2022_program.key(),
            cpi_accounts,
        );
        token_2022::burn(cpi_ctx, cost)?;

        let config = &mut ctx.accounts.campus_config;
        config.total_burned = config.total_burned.saturating_add(cost);

        let now = Clock::get()?.unix_timestamp;
        emit!(RewardRedeemed {
            student: ctx.accounts.student.key(),
            reward_id,
            cost,
            timestamp: now,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = CampusConfig::LEN,
        seeds = [b"config"],
        bump
    )]
    pub campus_config: Account<'info, CampusConfig>,

    #[account(mut)]
    pub mint: Signer<'info>,

    pub token_2022_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct RegisterIssuer<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"config"],
        bump = campus_config.bump,
        has_one = authority @ ErrorCode::UnauthorizedAuthority
    )]
    pub campus_config: Account<'info, CampusConfig>,

    /// CHECK: Public key of the issuer being registered
    pub issuer_authority: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = authority,
        space = IssuerAccount::LEN,
        seeds = [b"issuer", issuer_authority.key().as_ref()],
        bump
    )]
    pub issuer_account: Account<'info, IssuerAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct IssuePoints<'info> {
    #[account(mut)]
    pub issuer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"issuer", issuer.key().as_ref()],
        bump = issuer_account.bump,
        constraint = issuer_account.authority == issuer.key() @ ErrorCode::UnauthorizedIssuer,
    )]
    pub issuer_account: Account<'info, IssuerAccount>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = campus_config.bump,
        has_one = mint @ ErrorCode::InvalidMint,
    )]
    pub campus_config: Account<'info, CampusConfig>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    /// CHECK: Student recipient wallet
    pub recipient: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = issuer,
        associated_token::mint = mint,
        associated_token::authority = recipient,
        associated_token::token_program = token_2022_program,
    )]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_2022_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(reward_id: u64)]
pub struct CreateReward<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"config"],
        bump = campus_config.bump,
        has_one = authority @ ErrorCode::UnauthorizedAuthority,
    )]
    pub campus_config: Account<'info, CampusConfig>,

    #[account(
        init_if_needed,
        payer = authority,
        space = RewardCatalog::LEN,
        seeds = [b"reward", reward_id.to_le_bytes().as_ref()],
        bump
    )]
    pub reward: Account<'info, RewardCatalog>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(reward_id: u64)]
pub struct RedeemReward<'info> {
    #[account(mut)]
    pub student: Signer<'info>,

    #[account(
        mut,
        seeds = [b"reward", reward_id.to_le_bytes().as_ref()],
        bump = reward.bump,
    )]
    pub reward: Account<'info, RewardCatalog>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = campus_config.bump,
        has_one = mint @ ErrorCode::InvalidMint,
    )]
    pub campus_config: Account<'info, CampusConfig>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = student,
        associated_token::token_program = token_2022_program,
    )]
    pub student_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_2022_program: Program<'info, Token2022>,
}

#[account]
pub struct CampusConfig {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub total_issued: u64,
    pub total_burned: u64,
    pub bump: u8,
}

impl CampusConfig {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1;
}

#[account]
pub struct IssuerAccount {
    pub authority: Pubkey,
    pub is_active: bool,
    pub daily_limit: u64,
    pub issued_today: u64,
    pub last_reset: i64,
    pub bump: u8,
}

impl IssuerAccount {
    pub const LEN: usize = 8 + 32 + 1 + 8 + 8 + 8 + 1;
}

#[account]
pub struct RewardCatalog {
    pub reward_id: u64,
    pub cost: u64,
    pub is_available: bool,
    pub total_redeemed: u32,
    pub bump: u8,
}

impl RewardCatalog {
    pub const LEN: usize = 8 + 8 + 8 + 1 + 4 + 1;
}

#[event]
pub struct PointsIssued {
    pub issuer: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct RewardRedeemed {
    pub student: Pubkey,
    pub reward_id: u64,
    pub cost: u64,
    pub timestamp: i64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Caller is not authorized as protocol authority")]
    UnauthorizedAuthority,
    #[msg("Caller is not a registered or active issuer")]
    UnauthorizedIssuer,
    #[msg("Issuer is currently inactive")]
    IssuerInactive,
    #[msg("Daily issuance quota exceeded for this issuer")]
    DailyLimitExceeded,
    #[msg("Provided mint does not match protocol config mint")]
    InvalidMint,
    #[msg("Requested reward is currently unavailable")]
    RewardUnavailable,
    #[msg("Operation amount must be greater than zero")]
    InvalidAmount,
    #[msg("Arithmetic overflow occurred")]
    MathOverflow,
    #[msg("Failed to calculate required account space for Token-2022")]
    CalculationFailure,
}
