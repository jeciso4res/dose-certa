
const express = require('express');
const router = express.Router();
const pool = require('./db');
const autenticarToken = require('./autenticacao');

router.post('/', autenticarToken, async (req, res) => {
  const { tratamento_id, horario } = req.body;
  const usuarioId = req.usuario.id;

  if (!tratamento_id || !Number.isInteger(Number(tratamento_id)) ||
      Number(tratamento_id) <= 0) {
    return res.status(400).json({
      mensagem: 'Informe um ID de tratamento válido.'
    });
  }

  if (!horario || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) {
    return res.status(400).json({
      mensagem: 'Informe um horário válido no formato HH:MM.'
    });
  }

  try {
    const tratamento = await pool.query(
      `SELECT t.id
       FROM tratamentos t
       INNER JOIN medicamentos m
         ON m.id = t.medicamento_id
       WHERE t.id = $1
         AND m.usuario_id = $2`,
      [Number(tratamento_id), usuarioId]
    );

    if (tratamento.rowCount === 0) {
      return res.status(404).json({
        mensagem: 'Tratamento não encontrado.'
      });
    }

    const resultado = await pool.query(
      `INSERT INTO horarios_alertas (tratamento_id, horario)
       VALUES ($1, $2)
       RETURNING *`,
      [Number(tratamento_id), horario]
    );

    return res.status(201).json({
      mensagem: 'Horário de alerta cadastrado com sucesso!',
      horario_alerta: resultado.rows[0]
    });
  } catch (erro) {
    if (erro.code === '23505') {
      return res.status(409).json({
        mensagem: 'Este horário já está cadastrado para o tratamento.'
      });
    }

    console.error('Erro ao cadastrar horário de alerta:', erro);

    return res.status(500).json({
      mensagem: 'Erro interno ao cadastrar horário de alerta.'
    });
  }
});


router.get('/', autenticarToken, async (req, res) => {
  const usuarioId = req.usuario.id;

  try {
    const resultado = await pool.query(
      `SELECT
         ha.id,
         ha.tratamento_id,
         ha.horario,
         ha.ativo,
         ha.criado_em
       FROM horarios_alertas ha
       INNER JOIN tratamentos t
         ON t.id = ha.tratamento_id
       INNER JOIN medicamentos m
         ON m.id = t.medicamento_id
       WHERE m.usuario_id = $1
       ORDER BY ha.id`,
      [usuarioId]
    );

    return res.status(200).json({
      mensagem: 'Horários de alerta consultados com sucesso!',
      horarios_alertas: resultado.rows
    });
  } catch (erro) {
    console.error('Erro ao consultar horários de alerta:', erro);

    return res.status(500).json({
      mensagem: 'Erro interno ao consultar horários de alerta.'
    });
  }
});


router.get('/:id', autenticarToken, async (req, res) => {
  const horarioId = Number(req.params.id);
  const usuarioId = req.usuario.id;

  if (!Number.isInteger(horarioId) || horarioId <= 0) {
    return res.status(400).json({
      mensagem: 'ID do horário inválido.'
    });
  }

  try {
    const resultado = await pool.query(
      `SELECT
         ha.id,
         ha.tratamento_id,
         ha.horario,
         ha.ativo,
         ha.criado_em
       FROM horarios_alertas ha
       INNER JOIN tratamentos t
         ON t.id = ha.tratamento_id
       INNER JOIN medicamentos m
         ON m.id = t.medicamento_id
       WHERE ha.id = $1
         AND m.usuario_id = $2`,
      [horarioId, usuarioId]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        mensagem: 'Horário de alerta não encontrado.'
      });
    }

    return res.status(200).json({
      mensagem: 'Horário de alerta consultado com sucesso!',
      horario_alerta: resultado.rows[0]
    });
  } catch (erro) {
    console.error('Erro ao consultar horário de alerta:', erro);

    return res.status(500).json({
      mensagem: 'Erro interno ao consultar horário de alerta.'
    });
  }
});


router.put('/:id', autenticarToken, async (req, res) => {
  const horarioId = Number(req.params.id);
  const usuarioId = req.usuario.id;
  const { horario, ativo } = req.body;

  if (!Number.isInteger(horarioId) || horarioId <= 0) {
    return res.status(400).json({
      mensagem: 'ID do horário inválido.'
    });
  }

  if (
    horario === undefined &&
    ativo === undefined
  ) {
    return res.status(400).json({
      mensagem: 'Informe o horário ou o status ativo para atualizar.'
    });
  }

  if (
    horario !== undefined &&
    (typeof horario !== 'string' ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(horario))
  ) {
    return res.status(400).json({
      mensagem: 'Informe um horário válido no formato HH:MM.'
    });
  }

  if (ativo !== undefined && typeof ativo !== 'boolean') {
    return res.status(400).json({
      mensagem: 'O campo ativo deve ser true ou false.'
    });
  }

  try {
    const atual = await pool.query(
      `SELECT ha.*
       FROM horarios_alertas ha
       INNER JOIN tratamentos t
         ON t.id = ha.tratamento_id
       INNER JOIN medicamentos m
         ON m.id = t.medicamento_id
       WHERE ha.id = $1
         AND m.usuario_id = $2`,
      [horarioId, usuarioId]
    );

    if (atual.rowCount === 0) {
      return res.status(404).json({
        mensagem: 'Horário de alerta não encontrado.'
      });
    }

    const horarioAtual = atual.rows[0];

    const novoHorario = horario ?? horarioAtual.horario;
    const novoStatus = ativo ?? horarioAtual.ativo;

    const resultado = await pool.query(
      `UPDATE horarios_alertas
       SET horario = $1,
           ativo = $2
       WHERE id = $3
       RETURNING *`,
      [novoHorario, novoStatus, horarioId]
    );

    return res.status(200).json({
      mensagem: 'Horário de alerta atualizado com sucesso!',
      horario_alerta: resultado.rows[0]
    });
  } catch (erro) {
    if (erro.code === '23505') {
      return res.status(409).json({
        mensagem: 'Este horário já existe para o tratamento.'
      });
    }

    console.error('Erro ao atualizar horário de alerta:', erro);

    return res.status(500).json({
      mensagem: 'Erro interno ao atualizar horário de alerta.'
    });
  }
});


router.delete('/:id', autenticarToken, async (req, res) => {
  const horarioId = Number(req.params.id);
  const usuarioId = req.usuario.id;

  if (!Number.isInteger(horarioId) || horarioId <= 0) {
    return res.status(400).json({
      mensagem: 'ID do horário inválido.'
    });
  }

  try {
    const resultado = await pool.query(
      `DELETE FROM horarios_alertas ha
       USING tratamentos t, medicamentos m
       WHERE ha.tratamento_id = t.id
         AND t.medicamento_id = m.id
         AND ha.id = $1
         AND m.usuario_id = $2
       RETURNING ha.id`,
      [horarioId, usuarioId]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        mensagem: 'Horário de alerta não encontrado.'
      });
    }

    return res.status(200).json({
      mensagem: 'Horário de alerta excluído com sucesso!',
      id: resultado.rows[0].id
    });
  } catch (erro) {
    console.error('Erro ao excluir horário de alerta:', erro);

    return res.status(500).json({
      mensagem: 'Erro interno ao excluir horário de alerta.'
    });
  }
});


module.exports = router;
