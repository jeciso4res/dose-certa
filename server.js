
const express = require('express');
require('dotenv').config();
const usuariosRouter = require('./usuarios');
const authRouter = require('./auth');
const autenticarToken = require('./autenticacao');
const medicamentosRouter = require('./medicamentos');
const tratamentosRouter = require('./tratamentos');
const horariosAlertasRouter = require('./horarios-alertas');
const notificacoesRouter = require('./notificacoes');

const app = express();
const PORT = process.env.PORT || 3000;

// Permite que a API receba dados no formato JSON
app.use(express.json());
app.use('/usuarios', usuariosRouter);
app.use('/auth', authRouter);
app.use('/medicamentos', medicamentosRouter);
app.use('/tratamentos', tratamentosRouter);
app.use('/horarios-alertas', horariosAlertasRouter);
app.use('/notificacoes', notificacoesRouter);

// Rota inicial para verificar se o servidor está funcionando
app.get('/', (req, res) => {
    res.status(200).json({
        mensagem: 'API Dose Certa funcionando!'
    });
});

const pool = require('./db');

// Rota para verificar a conexão com o banco
app.get('/teste-banco', async (req, res) => {
    try {
        await pool.query('SELECT 1');

        res.status(200).json({
            mensagem: 'API e banco de dados funcionando!'
        });
    } catch (erro) {
        console.error('Erro ao consultar o banco:', erro.message);

        res.status(500).json({
            mensagem: 'Erro ao conectar ao banco de dados.'
        });
    }
});

app.get('/protegido', autenticarToken, (req, res) => {
    res.status(200).json({
        mensagem: 'Acesso autorizado!',
        usuario: req.usuario
    });
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor Dose Certa rodando na porta ${PORT}`);
});
