
const express = require('express');
const pool = require('./db');
const autenticarToken = require('./autenticacao');

const router = express.Router();

// Cadastrar um medicamento para o usuário autenticado
router.post('/', autenticarToken, async (req, res) => {
    try {
        const {
            nome,
            principio_ativo,
            dosagem,
            foto_embalagem,
            observacoes
        } = req.body;

        // Validar os campos obrigatórios
        if (
            typeof nome !== 'string' || !nome.trim() ||
            typeof principio_ativo !== 'string' || !principio_ativo.trim() ||
            typeof dosagem !== 'string' || !dosagem.trim()
        ) {
            return res.status(400).json({
                mensagem: 'Nome, princípio ativo e dosagem são obrigatórios.'
            });
        }

        // O usuário vem do token validado, não do corpo da requisição
        const usuarioId = req.usuario.id;

        const resultado = await pool.query(
            `INSERT INTO medicamentos
                (usuario_id, nome, principio_ativo, dosagem,
                 foto_embalagem, observacoes)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, usuario_id, nome, principio_ativo,
                       dosagem, foto_embalagem, observacoes, criado_em`,
            [
                usuarioId,
                nome.trim(),
                principio_ativo.trim(),
                dosagem.trim(),
                foto_embalagem || null,
                observacoes || null
            ]
        );

        return res.status(201).json({
            mensagem: 'Medicamento cadastrado com sucesso!',
            medicamento: resultado.rows[0]
        });

    } catch (erro) {
        console.error('Erro ao cadastrar medicamento:', erro.message);

        return res.status(500).json({
            mensagem: 'Não foi possível cadastrar o medicamento.'
        });
    }
});


router.get('/', autenticarToken, async (req, res) => {
    try {
        const usuarioId = req.usuario.id;

        const resultado = await pool.query(
            `SELECT id, usuario_id, nome, principio_ativo,
                    dosagem, foto_embalagem, observacoes, criado_em
             FROM medicamentos
             WHERE usuario_id = $1
             ORDER BY id DESC`,
            [usuarioId]
        );

        return res.status(200).json({
            mensagem: 'Medicamentos consultados com sucesso!',
            medicamentos: resultado.rows
        });

    } catch (erro) {
        console.error('Erro ao consultar medicamentos:', erro.message);

        return res.status(500).json({
            mensagem: 'Não foi possível consultar os medicamentos.'
        });
    }
});


router.get('/:id', autenticarToken, async (req, res) => {
    try {
        const medicamentoId = Number(req.params.id);

        if (!Number.isInteger(medicamentoId) || medicamentoId <= 0) {
            return res.status(400).json({
                mensagem: 'ID do medicamento inválido.'
            });
        }

        const usuarioId = req.usuario.id;

        const resultado = await pool.query(
            `SELECT id, usuario_id, nome, principio_ativo,
                    dosagem, foto_embalagem, observacoes, criado_em
             FROM medicamentos
             WHERE id = $1 AND usuario_id = $2`,
            [medicamentoId, usuarioId]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                mensagem: 'Medicamento não encontrado.'
            });
        }

        return res.status(200).json({
            mensagem: 'Medicamento consultado com sucesso!',
            medicamento: resultado.rows[0]
        });

    } catch (erro) {
        console.error('Erro ao consultar medicamento:', erro.message);

        return res.status(500).json({
            mensagem: 'Não foi possível consultar o medicamento.'
        });
    }
});


router.put('/:id', autenticarToken, async (req, res) => {
    try {
        const medicamentoId = Number(req.params.id);

        if (!Number.isInteger(medicamentoId) || medicamentoId <= 0) {
            return res.status(400).json({
                mensagem: 'ID do medicamento inválido.'
            });
        }

        const {
            nome,
            principio_ativo,
            dosagem,
            foto_embalagem,
            observacoes
        } = req.body;

        if (
            typeof nome !== 'string' || !nome.trim() ||
            typeof principio_ativo !== 'string' || !principio_ativo.trim() ||
            typeof dosagem !== 'string' || !dosagem.trim()
        ) {
            return res.status(400).json({
                mensagem: 'Nome, princípio ativo e dosagem são obrigatórios.'
            });
        }

        const usuarioId = req.usuario.id;

        const resultado = await pool.query(
            `UPDATE medicamentos
             SET nome = $1,
                 principio_ativo = $2,
                 dosagem = $3,
                 foto_embalagem = $4,
                 observacoes = $5
             WHERE id = $6 AND usuario_id = $7
             RETURNING id, usuario_id, nome, principio_ativo,
                       dosagem, foto_embalagem, observacoes, criado_em`,
            [
                nome.trim(),
                principio_ativo.trim(),
                dosagem.trim(),
                foto_embalagem ?? null,
                observacoes ?? null,
                medicamentoId,
                usuarioId
            ]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                mensagem: 'Medicamento não encontrado.'
            });
        }

        return res.status(200).json({
            mensagem: 'Medicamento atualizado com sucesso!',
            medicamento: resultado.rows[0]
        });

    } catch (erro) {
        console.error('Erro ao atualizar medicamento:', erro.message);

        return res.status(500).json({
            mensagem: 'Não foi possível atualizar o medicamento.'
        });
    }
});


router.delete('/:id', autenticarToken, async (req, res) => {
  const medicamentoId = Number(req.params.id);
  const usuarioId = req.usuario.id;

  if (!Number.isInteger(medicamentoId) || medicamentoId <= 0) {
    return res.status(400).json({
      mensagem: 'ID do medicamento inválido.'
    });
  }

  try {
    const resultado = await pool.query(
      `DELETE FROM medicamentos
       WHERE id = $1 AND usuario_id = $2
       RETURNING id`,
      [medicamentoId, usuarioId]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        mensagem: 'Medicamento não encontrado.'
      });
    }

    return res.status(200).json({
      mensagem: 'Medicamento excluído com sucesso!'
    });
  } catch (erro) {
    console.error('Erro ao excluir medicamento:', erro);

    return res.status(500).json({
      mensagem: 'Erro interno ao excluir medicamento.'
    });
  }
});


module.exports = router;