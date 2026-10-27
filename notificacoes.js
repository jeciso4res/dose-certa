
const express = require('express');
const router = express.Router();
const pool = require('./db');
const autenticarToken = require('./autenticacao');

router.post('/', autenticarToken, async (req, res) => {
  const { horario_alerta_id, mensagem } = req.body;
  const usuarioId = req.usuario.id;

  if (
    !Number.isInteger(Number(horario_alerta_id)) ||
    Number(horario_alerta_id) <= 0
  ) {
    return res.status(400).json({
      mensagem: 'Informe um ID de horário de alerta válido.'
    });
  }

  if (typeof mensagem !== 'string' || !mensagem.trim()) {
    return res.status(400).json({
      mensagem: 'A mensagem da notificação é obrigatória.'
    });
  }

  try {
    const horarioAlerta = await pool.query(
      `SELECT ha.id
       FROM horarios_alertas ha
       INNER JOIN tratamentos t
         ON t.id = ha.tratamento_id
       INNER JOIN medicamentos m
         ON m.id = t.medicamento_id
       WHERE ha.id = $1
         AND m.usuario_id = $2`,
      [Number(horario_alerta_id), usuarioId]
    );

    if (horarioAlerta.rowCount === 0) {
      return res.status(404).json({
        mensagem: 'Horário de alerta não encontrado.'
      });
    }

    const resultado = await pool.query(
      `INSERT INTO notificacoes
         (horario_alerta_id, data_hora, mensagem, status)
       VALUES ($1, CURRENT_TIMESTAMP, $2, 'pendente')
       RETURNING *`,
      [Number(horario_alerta_id), mensagem.trim()]
    );

    return res.status(201).json({
      mensagem: 'Notificação cadastrada com sucesso!',
      notificacao: resultado.rows[0]
    });
  } catch (erro) {
    console.error('Erro ao cadastrar notificação:', erro);

    return res.status(500).json({
      mensagem: 'Erro interno ao cadastrar notificação.'
    });
  }
});


router.get('/', autenticarToken, async (req, res) => {
  const usuarioId = req.usuario.id;

  try {
    const resultado = await pool.query(
      `SELECT
         n.id,
         n.horario_alerta_id,
         n.data_hora,
         n.mensagem,
         n.status,
         n.criado_em
       FROM notificacoes n
       INNER JOIN horarios_alertas ha
         ON ha.id = n.horario_alerta_id
       INNER JOIN tratamentos t
         ON t.id = ha.tratamento_id
       INNER JOIN medicamentos m
         ON m.id = t.medicamento_id
       WHERE m.usuario_id = $1
       ORDER BY n.data_hora DESC`,
      [usuarioId]
    );

    return res.status(200).json({
      mensagem: 'Notificações consultadas com sucesso!',
      notificacoes: resultado.rows
    });
  } catch (erro) {
    console.error('Erro ao consultar notificações:', erro);

    return res.status(500).json({
      mensagem: 'Erro interno ao consultar notificações.'
    });
  }
});


router.get('/:id', autenticarToken, async (req, res) => {
  const notificacaoId = Number(req.params.id);
  const usuarioId = req.usuario.id;

  if (!Number.isInteger(notificacaoId) || notificacaoId <= 0) {
    return res.status(400).json({
      mensagem: 'ID da notificação inválido.'
    });
  }

  try {
    const resultado = await pool.query(
      `SELECT
         n.id,
         n.horario_alerta_id,
         n.data_hora,
         n.mensagem,
         n.status,
         n.criado_em
       FROM notificacoes n
       INNER JOIN horarios_alertas ha
         ON ha.id = n.horario_alerta_id
       INNER JOIN tratamentos t
         ON t.id = ha.tratamento_id
       INNER JOIN medicamentos m
         ON m.id = t.medicamento_id
       WHERE n.id = $1
         AND m.usuario_id = $2`,
      [notificacaoId, usuarioId]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        mensagem: 'Notificação não encontrada.'
      });
    }

    return res.status(200).json({
      mensagem: 'Notificação consultada com sucesso!',
      notificacao: resultado.rows[0]
    });
  } catch (erro) {
    console.error('Erro ao consultar notificação:', erro);

    return res.status(500).json({
      mensagem: 'Erro interno ao consultar notificação.'
    });
  }
});


router.put('/:id', autenticarToken, async (req, res) => {
  const notificacaoId = Number(req.params.id);
  const usuarioId = req.usuario.id;
  const { mensagem, status } = req.body;

  if (!Number.isInteger(notificacaoId) || notificacaoId <= 0) {
    return res.status(400).json({
      mensagem: 'ID da notificação inválido.'
    });
  }

  if (mensagem === undefined && status === undefined) {
    return res.status(400).json({
      mensagem: 'Informe a mensagem ou o status para atualizar.'
    });
  }

  if (
    mensagem !== undefined &&
    (typeof mensagem !== 'string' || !mensagem.trim())
  ) {
    return res.status(400).json({
      mensagem: 'A mensagem não pode ficar vazia.'
    });
  }

  const statusPermitidos = ['pendente', 'enviada', 'cancelada'];

  if (status !== undefined && !statusPermitidos.includes(status)) {
    return res.status(400).json({
      mensagem: 'Status inválido. Use pendente, enviada ou cancelada.'
    });
  }

  try {
    const atual = await pool.query(
      `SELECT n.*
       FROM notificacoes n
       INNER JOIN horarios_alertas ha
         ON ha.id = n.horario_alerta_id
       INNER JOIN tratamentos t
         ON t.id = ha.tratamento_id
       INNER JOIN medicamentos m
         ON m.id = t.medicamento_id
       WHERE n.id = $1
         AND m.usuario_id = $2`,
      [notificacaoId, usuarioId]
    );

    if (atual.rowCount === 0) {
      return res.status(404).json({
        mensagem: 'Notificação não encontrada.'
      });
    }

    const notificacaoAtual = atual.rows[0];
    const novaMensagem = mensagem === undefined
      ? notificacaoAtual.mensagem
      : mensagem.trim();
    const novoStatus = status ?? notificacaoAtual.status;

    const resultado = await pool.query(
      `UPDATE notificacoes
       SET mensagem = $1,
           status = $2
       WHERE id = $3
       RETURNING *`,
      [novaMensagem, novoStatus, notificacaoId]
    );

    return res.status(200).json({
      mensagem: 'Notificação atualizada com sucesso!',
      notificacao: resultado.rows[0]
    });
  } catch (erro) {
    console.error('Erro ao atualizar notificação:', erro);

    return res.status(500).json({
      mensagem: 'Erro interno ao atualizar notificação.'
    });
  }
});


router.delete('/:id', autenticarToken, async (req, res) => {
  const notificacaoId = Number(req.params.id);
  const usuarioId = req.usuario.id;

  if (!Number.isInteger(notificacaoId) || notificacaoId <= 0) {
    return res.status(400).json({
      mensagem: 'ID da notificação inválido.'
    });
  }

  try {
    const resultado = await pool.query(
      `DELETE FROM notificacoes n
       USING horarios_alertas ha, tratamentos t, medicamentos m
       WHERE n.horario_alerta_id = ha.id
         AND ha.tratamento_id = t.id
         AND t.medicamento_id = m.id
         AND n.id = $1
         AND m.usuario_id = $2
       RETURNING n.id`,
      [notificacaoId, usuarioId]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        mensagem: 'Notificação não encontrada.'
      });
    }

    return res.status(200).json({
      mensagem: 'Notificação excluída com sucesso!',
      id: resultado.rows[0].id
    });
  } catch (erro) {
    console.error('Erro ao excluir notificação:', erro);

    return res.status(500).json({
      mensagem: 'Erro interno ao excluir notificação.'
    });
  }
});


module.exports = router;
