Roadmap do Projeto (Fases 0 a 5)
Fase 0: Auditoria de Ambiente e Estrutura Inicial

Verificação de versões locais (solana, anchor, rustc, node, pnpm).

Criação do diretório raiz e scaffold inicial do Anchor e do Frontend.

Fase 1: Programa Anchor com Token-2022 (Rust)

Configuração de dependências (Cargo.toml).

Implementação dos estados, contas PDA e erros.

Implementação das instruções: initialize, register_issuer, issue_points e redeem_reward.

Compilação local com anchor build.

Fase 2: Bateria de Testes Automatizados (TypeScript)

Script completo de testes on-chain.

Teste de inicialização e emissão autorizada.

Teste de bloqueio de transferência (prova criptográfica do Soulbound).

Teste de queima/resgate de recompensa e validação de saldo.

Execução local com anchor test.

Fase 3: Deploy e Inicialização na Devnet

Configuração da carteira de deploy e sincronização do Program ID.

Deploy do programa na Devnet da Solana.

Execução do script de setup inicial (criação da mint e registro do emissor).

Fase 4: Frontend Completo (Next.js + Tailwind + Wallet Adapter)

Scaffold do Next.js e instalação das dependências de carteira e Anchor.

Integração do IDL e tipos do contrato.

Construção das interfaces:

Dashboard do Aluno (saldo e histórico).

Mural de Missões do Mês.

Ranking (Leaderboard).

Loja de Recompensas (botão de resgate com burn on-chain).

Painel do Emissor / Admin (emissão de pontos).

Alternador de perfil (Aluno / Admin) para a banca testar em 1 clique.

Fase 5: Teste Ponta a Ponta e Roteiro do Vídeo

Validação de todo o fluxo na Devnet direto pelo navegador.

Roteiro fechado de apresentação e gravação do pitch de 2 a 3 minutos para a Superteam.


































# campus-points

Campus Points — Documento Conceitual e de Produto
Sistema de engajamento, reputação acadêmica e benefícios estudantis construído sobre a rede Solana, projetado para eliminar fraudes em atividades extracurriculares e criar uma economia interna no campus sem custo para o estudante.

1. Visão Geral do Projeto
O Campus Points é uma plataforma voltada para instituições de ensino superior que transforma a participação do aluno em atividades acadêmicas, esportivas e culturais em pontos digitais.

Diferente de sistemas convencionais de fidelidade ou planilhas de horas complementares, os pontos do Campus Points ficam vinculados diretamente ao estudante de forma permanente. O aluno pode acumular pontos por mérito próprio e queimá-los para obter descontos e produtos no campus, mas é tecnicamente impossível transferir ou vender esses pontos para outros alunos.

A infraestrutura utiliza a blockchain Solana para garantir transparência nas regras de emissão e auditoria pública, enquanto a universidade arca com as taxas operacionais da rede, garantindo que o estudante utilize a ferramenta de forma 100% gratuita.

2. O Problema
As universidades enfrentam três gargalos crônicos no gerenciamento de incentivo estudantil:

Baixa adesão e engajamento: A maioria dos alunos se limita a assistir às aulas obrigatórias. Palestras, eventos de extensão, monitorias e ações da atlética sofrem com baixa adesão pela falta de incentivo imediato e tangível.

Fraude em listas e horas complementares: Sistemas baseados em assinaturas de papel, QR codes estáticos ou formulários online são facilmente burlados. Alunos assinam presença para colegas que faltaram, gerando distorção nos registros de atividades.

Comércio paralelo de vantagens: Quando uma faculdade concede ingressos, vouchers ou vantagens por mérito, é comum que alunos vendam esses benefícios para terceiros que não participaram do esforço acadêmico.

Sistemas legados desconectados: O controle de horas complementares costuma ficar em um sistema acadêmico engessado, que não conversa com os serviços do dia a dia do campus (cantina, xerox, eventos esportivos e diretório acadêmico).

3. A Solução: Pontos Intransferíveis
O Campus Points estabelece uma ponte direta entre a dedicação do aluno e benefícios práticos no seu dia a dia universitário.

O pilar central da solução é o conceito de ativo intransferível (Soulbound):

Quando o aluno conclui uma atividade validada, a universidade emite os pontos diretamente para a conta dele.

Esses pontos ficam travados: se o aluno tentar repassar o saldo para outro colega, a própria rede rejeita a operação automaticamente.

O único destino possível para os pontos é a queima no resgate: ao escolher um benefício no catálogo, os pontos são destruídos de forma definitiva em troca da liberação do benefício.

Isso elimina qualquer mercado secundário de venda de presença ou de pontos, preservando o valor real da reputação do estudante.

4. Jornadas dos Usuários
Jornada do Aluno
Acesso: O aluno entra no aplicativo web do campus e vincula sua carteira digital.

Descoberta: Na aba de missões, consulta as atividades do mês que geram pontuação, como presença em simpósios, publicação de artigos, participação em treinos da atlética ou devolução pontual de livros na biblioteca.

Acúmulo: Após a validação do organizador, o aluno recebe os pontos sem pagar taxa alguma e acompanha sua posição no ranking geral do campus.

Resgate: Na loja de benefícios, escolhe um prêmio (desconto na mensalidade, vale-lanche na cantina, créditos de xerox ou ingresso de jogos) e confirma a troca. Os pontos são debitados e um cupom autenticado é gerado na tela.

Jornada da Universidade (Professores, Atléticas e Coordenação)
Controle de Autoridade: A reitoria define quais departamentos ou professores têm permissão para conceder pontos e estabelece limites diários de emissão para cada um, evitando abusos.

Validação de Atividades: Ao final de uma aula especial ou projeto, o professor abre seu painel administrativo, seleciona o evento e autoriza a concessão de pontos aos alunos presentes.

Auditoria: A instituição tem acesso a um painel transparente que mostra exatamente quantos pontos foram criados, por quem, e quantos foram consumidos em benefícios, facilitando o fechamento financeiro com os parceiros comerciais do campus.

Jornada dos Parceiros Comerciais (Cantinas, Livrarias e Serviços)
Parceria com a Instituição: Os comerciantes locais aceitam receber os cupons do sistema como parte de acordos institucionais de atração de clientes ou subsídios da faculdade.

Validação na Entrega: Ao receber o estudante no balcão, o atendente confere o cupom gerado na hora pelo aplicativo, entrega o produto e marca o benefício como utilizado.

5. Módulos da Aplicação
Interface do Aluno
Painel Principal: Visão rápida do saldo disponível, atividades recentes concluídas e status do perfil.

Mural de Missões: Lista detalhada de atividades ativas no mês, categorizadas em Acadêmico, Esportivo, Social e Eventos, acompanhadas da pontuação correspondente.

Quadro de Líderes (Ranking): Tabela pública com os estudantes com maior pontuação acumulada no semestre, promovendo competição saudável e reconhecimento público.

Catálogo de Benefícios: Prateleira de recompensas com indicação visual de itens acessíveis com o saldo atual e itens que exigem maior pontuação.

Painel Administrativo
Área de Validação: Interface rápida para emissores autorizados concederem pontos individuais ou em lote.

Gestor de Regras: Controle de cotas máximas de emissão por evento e bloqueio de emissores inativos.

Controle da Loja: Cadastro, edição e desativação de itens no catálogo de prêmios.

6. Por Que Utilizar a Solana?
Taxas Próximas de Zero: As taxas de transação na Solana custam uma fração de centavo de dólar. Isso viabiliza que a própria universidade patrocine todas as transações, garantindo que o estudante nunca precise gastar dinheiro para utilizar a plataforma.

Confirmação Instantânea: Transações processadas em frações de segundo evitam filas na cantina ou aglomerações na entrada de eventos durante a validação dos pontos.

Travas Nativas no Nível do Protocolo: A tecnologia de tokens de última geração da Solana permite configurar regras de intransferibilidade nativas, sem depender de scripts intermediários que poderiam falhar ou ser burlados.

Auditoria Pública e Descentralizada: Os registros de emissão e consumo de benefícios ficam públicos e imutáveis, eliminando desconfianças entre corpo docente, diretório acadêmico e estabelecimentos parceiros.

7. Modelo de Sustentabilidade e Ciclo de Vida dos Pontos
O ecossistema opera sob uma lógica de controle de oferta e demanda:

Entrada (Emissão): Pontos só são gerados mediante comprovação de esforço acadêmico ou comunitário real, sempre respeitando os tetos diários atribuídos a cada autoridade.

Retenção: Os pontos ficam retidos na posse do aluno como métrica de reputação acumulada para o ranking do semestre.

Saída (Queima): Ao trocar por um benefício real, os pontos deixam de existir, impedindo o acúmulo descontrolado e a perda de valor do programa de incentivos.

A faculdade ganha maior retenção de alunos e participação ativa em eventos, enquanto os estabelecimentos parceiros aumentam o fluxo de estudantes em suas dependências.

8. Fluxo de Validação para Apresentação e Demonstração
Para fins de avaliação pelos jurados e gravação do vídeo de submissão, a demonstração do projeto é conduzida em quatro etapas contínuas:

Conexão Inicial: O avaliador acessa a aplicação e conecta uma carteira na rede de testes, assumindo o papel de um estudante recém-chegado com saldo zerado.

Atribuição de Reconhecimento: O avaliador acessa o painel de emissor institucional e concede pontos referentes à participação em uma palestra. O saldo é atualizado em tempo real na interface do aluno.

Verificação de Intransferibilidade: O avaliador tenta enviar uma fração de seus pontos para outra carteira usando sua própria carteira digital. A rede recusa a movimentação, comprovando a eficácia da proteção contra fraudes.

Resgate do Benefício: No catálogo, o avaliador seleciona uma recompensa, autoriza a troca e observa os pontos sendo destruídos, resultando na emissão imediata de um comprovante para uso no campus.
