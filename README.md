# Teste do Mercado Pago

Site separado só pra testar pagamentos do Mercado Pago: mostra o que o cliente vê (Pix com QR Code e copia e cola, ou a página do Mercado Pago com Pix e cartão), acompanha o status, o tempo até aprovar, a taxa, quanto você recebe e quando o dinheiro fica disponível. Tem botão pra devolver o dinheiro (reembolso).

## Colocar no ar (Netlify)
1. Add new site → Import an existing project → GitHub → este repositório. Não precisa de comando de build.
2. Environment variables:
   - `MP_ACCESS_TOKEN`: Access Token de **produção** do Mercado Pago (APP_USR-...). Secreto.
   - `TESTE_SENHA`: uma senha pra entrar na página. Secreto.
3. Deploy. Abra o endereço, digite a senha e faça um Pix de R$ 1 com outro banco.
