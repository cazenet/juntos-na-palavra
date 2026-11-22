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
