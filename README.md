# Campus Points Protocol

Protocolo descentralizado de reputacao academica e gestao de incentivos estudantis construído na Solana. O sistema utiliza a extensao Non-Transferable do padrao SPL Token-2022 para emitir pontos com caracteristica Soulbound, garantindo que o merito estudantil permaneca vinculado a identidade de quem o conquistou, com queima definitiva no resgate de beneficios universitarios.

---

## Deployments e Contas On-Chain (Solana Devnet)

| Componente | Endereco / Public Key |
| :--- | :--- |
| **Program ID** | `53sEPq9sSPaaYHYf3MdjMXjqMPpRBLpxTSyWs7EMo5Bb` |
| **Mint Token-2022** | `CPi3yJBCqL3p6gGSLq1kqPT5RWp1qbT7RgbdveV9ZpPR` |
| **CampusConfig PDA** | `2sbQ9ZoZ7mNYP5RRjQXTSzVhdCjzp6NdD46JBtzEJ7t2` |
| **Autoridade Master** | `7aSDp11gPbCCew7yMSQKuBLr6pcKfgwRPtp2QgAE89f3` |
| **Token Program** | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` (Token-2022) |

---

## Fundamentos Tecnicos e Arquitetura

O Campus Points resolve o problema de inflacao descontrolada, comercio paralelo de beneficios estudantis e burocracia de validacao academica atraves de 4 pilares criptograficos:

1. **Reputacao Intransferivel (Soulbound Nativo):** A emissao utiliza a extensao `NonTransferable` do Token-2022 inicializada diretamente no runtime da Solana. Qualquer tentativa de transferencia arbitraria entre carteiras de estudantes e rejeitada a nivel de maquina de estados.
2. **Emissao Institucional Controlada por Cotas:** Apenas carteiras previamente registradas como emissoras (`IssuerAccount`) podem cunhar pontos. Cada emissor possui um teto diario (`daily_limit`), impedindo a cunhagem desordenada.
3. **Mecanismo de Resgate com Queima Definitiva (Burn):** Ao reivindicar recompensas do catalogo, o contrato executa uma chamada CPI para a instrucao `burn` do Token-2022. Os tokens sao destruidos on-chain, evitando reutilizacao ou fraudes contabeis.
4. **Validacao Sematrizada por PDAs:** Toda a contabilidade de estado e isolada em enderecos derivados:
   * `config`: Seed `["config"]` — Parametros globais e autoridade do protocolo.
   * `issuer`: Seed `["issuer", issuer_pubkey]` — Cota, status ativo e historico de emissao.
   * `reward`: Seed `["reward", reward_id_le_bytes]` — Custo em pontos e status do item.

---

## Instrucoes do Smart Contract

### 1. `initialize`
Inicializa a conta global `CampusConfig` e cria a Mint Token-2022 com a extensao `NonTransferable`.
* **Signers obrigatorios:** `authority` e `mint_keypair`.

### 2. `register_issuer`
Cadastra ou atualiza uma autoridade emissora (coordenadores de curso, diretores de centro ou centros academicos), atribuindo uma cota maxima diaria de pontos.
* **Acesso:** Restrito a `authority` do protocolo.
* **Argumentos:** `daily_limit: u64`, `is_active: bool`.

### 3. `issue_points`
Emite tokens para a conta de token associada (ATA) de um estudante.
* **Acesso:** Qualquer carteira com `IssuerAccount` ativa.
* **Validacoes:** Verifica se o valor solicitado nao excede a cota restante da autoridade emissora no dia corrente.
* **Argumentos:** `amount: u64`.

### 4. `create_reward`
Registra itens no catalogo de beneficios do campus.
* **Acesso:** Restrito a `authority`.
* **Argumentos:** `reward_id: u64`, `cost: u64`.

### 5. `redeem_reward`
Executa o resgate do beneficio selecionado.
* **Acesso:** Carteira do estudante proprietaria dos tokens.
* **Operacao:** Executa CPI de queima (`burn`) de exatamente `reward.cost` tokens na ATA do estudante.

---

## Seguranca e Mitigacao de Vetores de Ataque

* **Prevencao contra Sybil e Venda de Contas:** Ao utilizar a extensao Non-Transferable do Token-2022, o protocolo elimina a possibilidade de criacao de um mercado secundario informal para compra de presencas ou creditos de xerox.
* **Controle de Privilegios Rigido:** Apenas a autoridade central pode alterar parametros criticos do protocolo ou credenciar novas entidades emissoras.
* **Zero-Reentrancy e Execucao Atomica:** O resgate e a queima de tokens ocorrem em uma unica instrucao transacional. Se a queima falhar, o estado da recompensa nao e consolidado.
* **Protecao de Rent:** Todas as contas PDA sao criadas com calculo estrito de espaco em bytes, alocando exatamente a quantidade necessaria para rent exemption permanente.

---

## Estrutura do Repositorio

```text
├── programs/
│   └── campus_points/
│       ├── Cargo.toml
│       └── src/
│           └── lib.rs              # Smart contract Anchor (Token-2022)
├── tests/
│   └── campus_points.ts            # Suite de testes de integracao E2E
├── scripts/
│   └── setup_devnet.ts             # Script de inicializacao de estado na Devnet
├── app/
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── issuer/         # Endpoints para gestao e subsidio de emissores
│   │   │   │   └── submissions/    # Fila sincronizada de solicitacoes de missoes
│   │   │   ├── page.tsx            # DApp Mobile-First integrado com Solana Devnet
│   │   │   └── layout.tsx
│   │   ├── components/             # Adaptadores de carteira e modais de instrucao
│   │   └── constants/              # IDL gerado e configuracoes de rede
│   ├── package.json
│   └── tailwind.config.js
├── Anchor.toml
└── README.md
```

---

## Guia de Execucao Local

### Pre-requisitos
* Rust v1.75+ e Cargo
* Solana CLI v1.18+
* Anchor CLI v0.30.1
* Node.js v18+ e Yarn

### 1. Build e Testes do Smart Contract
```bash
anchor build
anchor test
```

### 2. Deploy On-Chain (Devnet)
```bash
solana program deploy \
  --url "[https://api.devnet.solana.com](https://api.devnet.solana.com)" \
  --program-id target/deploy/campus_points-keypair.json \
  target/deploy/campus_points.so
```

### 3. Execucao do Frontend
```bash
cd app
yarn install
yarn dev
```


---

## Roadmap de Producao

1. **Embedded Wallets via MPC / Account Abstraction:** Substituicao da exigencia de extensao de carteira Web3 por autenticacao social e SSO institucional (Google Workspace/SAML universitario), com geracao automatica de carteiras Solana em segundo plano.
2. **Gasless Transactions (Octane / Paymaster):** Subsidio total das taxas de transacao pelo caixa da universidade, eliminando a necessidade de o estudante possuir SOL para queimar ou reivindicar pontos.
3. **Verificacao com Provas de Conhecimento Zero (ZK Proofs):** Integracao de credenciais anonimizadas para comprovacao de bolsas de estudo, quotas de renda e integracao com diretórios academicos sem expor dados pessoais on-chain.
