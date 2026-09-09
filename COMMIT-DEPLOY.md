# COMMIT E DEPLOY — ACHA 1.0.21

Nesta versão, `data/db.json` faz parte do estado versionado do ACHA.

## Git

```bash
git status
git add .
git commit -m "chore: versiona dados do ACHA junto ao código"
git push origin main
```

## Portainer

Ao atualizar a Stack a partir do repositório, a imagem será reconstruída com o `data/db.json` presente no commit.

Importante: esta versão não usa o volume Docker `acha_data`. Portanto, o estado que deve ser preservado entre versões é o arquivo `data/db.json` do repositório.

Esta é uma solução transitória. A próxima etapa é migrar a persistência para MySQL.
