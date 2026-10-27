
const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('./db');

const router = express.Router();

// Cadastrar um novo usuário
router.post('/', async (req, res) => {
    try {
        const { nome, email, senha, tipo_usuario } = req.body;

        // Validar os campos obrigatórios
        if (!nome || !email || !senha || !tipo_usuario) {
            return res.status(400).json({
                mensagem: 'Preencha todos os campos obrigatórios.'
            });
        }

        // Validar o tipo de usuário
        if (!['usuario', 'cuidador'].includes(tipo_usuario)) {
            return res.status(400).json({
                mensagem: 'O tipo deve ser usuario ou cuidador.'
            });
        }

        if (senha.length < 8) {
            return res.status(400).json({
                mensagem: 'A senha deve ter pelo menos 8 caracteres.'
            });
        }

        // Verificar se o e-mail já está cadastrado
        const existente = await pool.query(
            'SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1)',
            [email.trim()]
        );

        if (existente.rows.length > 0) {
            return res.status(409).json({
                mensagem: 'Este e-mail já está cadastrado.'
            });
        }

        // Gerar o hash da senha
        const senhaHash = await bcrypt.hash(senha, 12);

        // Salvar o usuário no banco
        const resultado = await pool.query(
            `INSERT INTO usuarios (nome, email, senha_hash, tipo_usuario)
             VALUES ($1, $2, $3, $4)
             RETURNING id, nome, email, tipo_usuario, criado_em`,
            [nome.trim(), email.trim().toLowerCase(), senhaHash, tipo_usuario]
        );

        return res.status(201).json({
            mensagem: 'Usuário cadastrado com sucesso!',
            usuario: resultado.rows[0]
        });

    } catch (erro) {
        console.error('Erro ao cadastrar usuário:', erro.message);

        return res.status(500).json({
            mensagem: 'Não foi possível cadastrar o usuário.'
        });
    }
});

module.exports = router;
