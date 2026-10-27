
const express = require('express');
const router = express.Router();

const pool = require('./db');
const autenticarToken = require('./autenticacao');

router.post('/', autenticarToken, async (req, res) => {
  const {
    medicamento_id,
    data_inicio,
    data_fim,
    instrucoes
  } = req.body;

  const usuarioId = req.usuario.id;

  if (
    medicamento_id === undefined ||
    !Number.isInteger(Number(medicamento_id)) ||
    Number(medicamento_id) <= 0
  ) {
    return res.status(400).json({
      mensagem: 'Informe um ID de medicamento válido.'
    });
  }

  if (!data_inicio) {
    return res.status(400).json({
      mensagem: 'A data de início é obrigatória.'
    });
  }

  const dataInicioValida =
    /^\d{4}-\d{2}-\d{2}$/.test(data_inicio) &&
    !Number.isNaN(Date.parse(data_inicio)) &&
    new Date(data_inicio).toISOString().slice(0, 10) === data_inicio;

  if (!dataInicioValida) {
    return res.status(400).json({
      mensagem: 'A data de início deve estar no formato AAAA-MM-DD.'
    });
  }

  if (data_fim !== undefined && data_fim !== null && data_fim !== '') {
    const dataFimValida =
      /^\d{4}-\d{2}-\d{2}$/.test(data_fim) &&
      !Number.isNaN(Date.parse(data_fim)) &&
      new Date(data_fim).toISOString().slice(0, 10) === data_fim;

    if (!dataFimValida) {
      return res.status(400).json({
        mensagem: 'A data de fim deve estar no formato AAAA-MM-DD.'
      });
    }

    if (data_fim < data_inicio) {
      return res.status(400).json({
        mensagem: 'A data de fim não pode ser anterior à data de início.'
      });
    }
  }

  try {
    const medicamento = await pool.query(
      `SELECT id
       FROM medicamentos
       WHERE id = $1 AND usuario_id = $2`,
      [Number(medicamento_id), usuarioId]
    );

    if (medicamento.rowCount === 0) {
      return res.status(404).json({
        mensagem: 'Medicamento não encontrado para este usuário.'
      });
    }

    const resultado = await pool.query(
      `INSERT INTO tratamentos
        (medicamento_id, data_inicio, data_fim, instrucoes, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, medicamento_id, data_inicio, data_fim,
                 instrucoes, status, criado_em`,
      [
        Number(medicamento_id),
        data_inicio,
        data_fim || null,
        instrucoes || null,
        'ativo'
      ]
    );

    return res.status(201).json({
      mensagem: 'Tratamento cadastrado com sucesso!',
      tratamento: resultado.rows[0]
    });
  } catch (erro) {
    console.error('Erro ao cadastrar tratamento:', erro);

    return res.status(500).json({
      mensagem: 'Erro interno ao cadastrar tratamento.'
    });
  }
});


router.get('/', autenticarToken, async (req, res) => {
  const usuarioId = req.usuario.id;

  try {
    const resultado = await pool.query(
      `SELECT
         t.id,
         t.medicamento_id,
         m.nome AS medicamento_nome,
         t.data_inicio,
         t.data_fim,
         t.instrucoes,
         t.status,
         t.criado_em
       FROM tratamentos t
       INNER JOIN medicamentos m
         ON m.id = t.medicamento_id
       WHERE m.usuario_id = $1
       ORDER BY t.id`,
      [usuarioId]
    );

    return res.status(200).json({
      mensagem: 'Tratamentos consultados com sucesso!',
      tratamentos: resultado.rows
    });
  } catch (erro) {
    console.error('Erro ao consultar tratamentos:', erro);

    return res.status(500).json({
      mensagem: 'Erro interno ao consultar tratamentos.'
    });
  }
});


router.get('/:id', autenticarToken, async (req, res) => {
  const tratamentoId = Number(req.params.id);
  const usuarioId = req.usuario.id;

  if (!Number.isInteger(tratamentoId) || tratamentoId <= 0) {
    return res.status(400).json({
      mensagem: 'ID do tratamento inválido.'
    });
  }

  try {
    const resultado = await pool.query(
      `SELECT
         t.id,
         t.medicamento_id,
         m.nome AS medicamento_nome,
         t.data_inicio,
         t.data_fim,
         t.instrucoes,
         t.status,
         t.criado_em
       FROM tratamentos t
       INNER JOIN medicamentos m
         ON m.id = t.medicamento_id
       WHERE t.id = $1
         AND m.usuario_id = $2`,
      [tratamentoId, usuarioId]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        mensagem: 'Tratamento não encontrado.'
      });
    }

    return res.status(200).json({
      mensagem: 'Tratamento consultado com sucesso!',
      tratamento: resultado.rows[0]
    });
  } catch (erro) {
    console.error('Erro ao consultar tratamento:', erro);

    return res.status(500).json({
      mensagem: 'Erro interno ao consultar tratamento.'
    });
  }
});


router.put('/:id', autenticarToken, async (req, res) => {
  const tratamentoId = Number(req.params.id);
  const usuarioId = req.usuario.id;

  const {
    data_inicio,
    data_fim,
    instrucoes,
    status
  } = req.body;

  if (!Number.isInteger(tratamentoId) || tratamentoId <= 0) {
    return res.status(400).json({
      mensagem: 'ID do tratamento inválido.'
    });
  }

  const statusPermitidos = ['ativo', 'pausado', 'concluido'];

  if (status && !statusPermitidos.includes(status)) {
    return res.status(400).json({
      mensagem: 'Status inválido. Use ativo, pausado ou concluido.'
    });
  }

  const formatoData = /^\d{4}-\d{2}-\d{2}$/;

  if (
    data_inicio !== undefined &&
    (!formatoData.test(data_inicio) ||
      Number.isNaN(Date.parse(data_inicio)))
  ) {
    return res.status(400).json({
      mensagem: 'Data de início inválida. Use YYYY-MM-DD.'
    });
  }

  if (
    data_fim !== undefined &&
    data_fim !== null &&
    data_fim !== '' &&
    (!formatoData.test(data_fim) ||
      Number.isNaN(Date.parse(data_fim)))
  ) {
    return res.status(400).json({
      mensagem: 'Data de fim inválida. Use YYYY-MM-DD.'
    });
  }

  try {
    const atual = await pool.query(
      `SELECT t.*
       FROM tratamentos t
       INNER JOIN medicamentos m
         ON m.id = t.medicamento_id
       WHERE t.id = $1
         AND m.usuario_id = $2`,
      [tratamentoId, usuarioId]
    );

    if (atual.rowCount === 0) {
      return res.status(404).json({
        mensagem: 'Tratamento não encontrado.'
      });
    }

    const tratamentoAtual = atual.rows[0];

    const novaDataInicio =
      data_inicio ?? tratamentoAtual.data_inicio;

    const novaDataFim =
      data_fim === undefined
        ? tratamentoAtual.data_fim
        : (data_fim === '' ? null : data_fim);

    if (
      novaDataFim &&
      new Date(novaDataFim) < new Date(novaDataInicio)
    ) {
      return res.status(400).json({
        mensagem: 'A data de fim não pode ser anterior à data de início.'
      });
    }

    const resultado = await pool.query(
      `UPDATE tratamentos
       SET data_inicio = $1,
           data_fim = $2,
           instrucoes = $3,
           status = $4
       WHERE id = $5
       RETURNING *`,
      [
        novaDataInicio,
        novaDataFim,
        instrucoes ?? tratamentoAtual.instrucoes,
        status ?? tratamentoAtual.status,
        tratamentoId
      ]
    );

    return res.status(200).json({
      mensagem: 'Tratamento atualizado com sucesso!',
      tratamento: resultado.rows[0]
    });
  } catch (erro) {
    console.error('Erro ao atualizar tratamento:', erro);

    return res.status(500).json({
      mensagem: 'Erro interno ao atualizar tratamento.'
    });
  }
});


router.delete('/:id', autenticarToken, async (req, res) => {
  const tratamentoId = Number(req.params.id);
  const usuarioId = req.usuario.id;

  if (!Number.isInteger(tratamentoId) || tratamentoId <= 0) {
    return res.status(400).json({
      mensagem: 'ID do tratamento inválido.'
    });
  }

  try {
    const resultado = await pool.query(
      `DELETE FROM tratamentos t
       USING medicamentos m
       WHERE t.medicamento_id = m.id
         AND t.id = $1
         AND m.usuario_id = $2
       RETURNING t.id`,
      [tratamentoId, usuarioId]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        mensagem: 'Tratamento não encontrado.'
      });
    }

    return res.status(200).json({
      mensagem: 'Tratamento excluído com sucesso!',
      id: resultado.rows[0].id
    });
  } catch (erro) {
    console.error('Erro ao excluir tratamento:', erro);

    return res.status(500).json({
      mensagem: 'Erro interno ao excluir tratamento.'
    });
  }
});


module.exports = router;
