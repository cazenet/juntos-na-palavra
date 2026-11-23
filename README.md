# Juntos na Palavra — PWA

Aplicativo da Célula Adonai para planos de leitura bíblica, acompanhamento individual e reflexões.

## Publicação

O projeto é hospedado no GitHub Pages pela branch `main`, pasta `/ (root)`.

## Firebase

- Authentication: Google habilitado.
- Domínio autorizado: `cazenet.github.io`.
- Firestore: regras no arquivo `firestore.rules`.
- A configuração Web do Firebase fica no `app.js`.

## Funcionalidades desta versão

- Login Google e aprovação administrativa.
- Criação de planos de leitura pelo ADM.
- Planos independentes, sem substituir os anteriores.
- Geração do cronograma semanal a partir da lista de livros e capítulos.
- Registro de progresso individual por participante.
- Reflexões privadas ou compartilhadas.

## Formato para cadastrar livros

Uma linha por livro, no formato `Nome do livro: quantidade de capítulos`.
Exemplo:

```text
Mateus: 28
Marcos: 16
Lucas: 24
```

## Atualização de segurança

Ao publicar esta versão, copie o conteúdo atualizado de `firestore.rules` para Firebase Console → Firestore Database → Regras e publique. As regras agora incluem a subcoleção `plans/{planId}/progress/{uid}` para proteger o progresso individual.

Não convide participantes para usar o novo módulo de leitura até que as regras atualizadas estejam publicadas e o teste de progresso esteja concluído.


## Reflexões semanais (V3)
Cada participante registra uma reflexão por semana e por plano. O documento usa um ID determinístico (UID + plano + semana), permitindo editar a reflexão existente sem criar várias publicações. As respostas são divididas em três perguntas e podem ser privadas ou compartilhadas. Não há ranking ou pontuação.

Após enviar os arquivos, publique também o conteúdo atualizado de `firestore.rules` no Firebase Console > Firestore Database > Regras. O Firestore pode solicitar a criação de um índice composto para a consulta de reflexões compartilhadas; siga o link de criação exibido no erro, se aparecer.

## Painel inicial e encontro da célula
A tela inicial reúne saudação personalizada, leitura da semana, progresso, atalhos para reflexão/comunidade e informações do próximo encontro. O encontro é editável pelo administrador em **ADM → Próximo encontro da célula**. Na primeira abertura, o padrão sugerido é a próxima sexta-feira às 20h, na Casa do José Carlos e da Ilma, Rua Dempachi Nakayama, 634 — Jardim Esperança, Barueri - SP. As alterações são salvas no documento `plans/_app_settings` do Firestore; as regras existentes da coleção `plans` já permitem leitura aos participantes aprovados e gravação aos administradores.
