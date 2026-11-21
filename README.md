# Juntos na Palavra — integração inicial Firebase

PWA estático publicado no GitHub Pages. Esta versão conecta Google Authentication e Cloud Firestore.

## Arquivos
- `index.html`, `style.css`, `app.js`: interface e aplicação.
- `firestore.rules`: regras de segurança para publicar no Firestore.
- `manifest.webmanifest`, `sw.js`: recursos PWA.

## Publicação
Envie os arquivos para a raiz da branch `main` do repositório e mantenha GitHub Pages em `main` / `(root)`.

## Configuração necessária no Firebase
1. Authentication: habilite o provedor Google.
2. Authentication > Configurações > Domínios autorizados: inclua `cazenet.github.io`.
3. Firestore: abra Regras, substitua o conteúdo pelas regras de `firestore.rules` e publique.
4. Confirme que o projeto usa o banco `(default)`.

O administrador principal é reconhecido por e-mail verificado `cazenet10@gmail.com` nas regras do Firestore. Não é possível elevar privilégios alterando o perfil pelo navegador.

## Observações
- Novos usuários criam apenas seu próprio pedido com status `pending`.
- Apenas o administrador principal pode listar e aprovar solicitações nesta primeira versão.
- Reflexões privadas são legíveis somente pelo autor; reflexões compartilhadas são legíveis por participantes aprovados.
- O progresso de capítulos, gestão completa de cronogramas e delegação de administradores ainda não foram implementados nesta etapa.
