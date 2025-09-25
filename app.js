/* script.js
   Calculadora multi-contratos con:
   - bloques dinámicos (tipo + hora inicio/fin)
   - aplicación de porcentajes según reglas dadas
   - detección domingo / festivo (Colombia 2025 lista base)
   - generación de desprendible y exportación (ventana imprimible -> Guardar como PDF)
*/

/* ------------- CONFIGURACION ------------- */
const SMLV = 1300000;
const AUX_TRANS = 162000;
const FECHA_REFORMA_NOCT = new Date("2025-12-25");
const DOM_AUM_80 = new Date("2025-07-01");
const DOM_AUM_90 = new Date("2026-07-01");
const DOM_AUM_100 = new Date("2027-07-01");

const FESTIVOS_2025 = [
  "2025-01-01","2025-01-06","2025-03-24","2025-03-25","2025-05-01","2025-05-14",
  "2025-06-16","2025-07-20","2025-08-07","2025-08-18","2025-10-13","2025-11-03",
  "2025-11-17","2025-12-08","2025-12-25"
];
/* ----------------------------------------- */

// Inyectar estilos para campos con error
(function() {
  const style = document.createElement('style');
  style.textContent = `
    .campo-error {
      border: 2px solid #e74c3c !important;
      background-color: #fff9f9 !important;
      border-radius: 4px;
      box-shadow: 0 0 0 2px rgba(231, 76, 60, 0.2) !important;
      transition: all 0.2s ease;
    }
    .campo-error:focus {
      outline: none !important;
      box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.3) !important;
    }
    #mensaje-global .enlace-campo {
      display: block;
      margin-top: 6px;
      color: #2980b9;
      text-decoration: none;
      font-weight: 600;
      font-size: 13px;
    }
    #mensaje-global .enlace-campo:hover {
      text-decoration: underline;
    }
  `;
  document.head.appendChild(style);
})();

/* ------- TAB NAV ------- */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const id = btn.dataset.tab;
    document.getElementById(id).classList.add('active');
  });
});

/* ------- HELPERS ------- */
function el(id) { return document.getElementById(id); }
function isEmpty(v) { return v === null || v === undefined || v === '' || v === '0' || v === 0; }
function formatMoney(v) { return '$' + Math.round(v).toLocaleString(); }

function toMinutes(timeStr) {
  if (!timeStr) return null;
  const [hh, mm] = timeStr.split(':').map(Number);
  return hh * 60 + (mm || 0);
}

function diffHours(start, end) {
  if (!start || !end) return 0;
  const s = toMinutes(start);
  const e = toMinutes(end);
  let diff = (e - s) / 60;
  if (diff < 0) diff += 24;
  return Math.round(diff * 100) / 100;
}

function isDominicalOrFestivo(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const iso = dateStr;
  const domingo = d.getDay() === 0;
  const festivo = FESTIVOS_2025.includes(iso);
  return domingo || festivo;
}

function pctForType(tipo, fechaStr) {
  const fecha = fechaStr ? new Date(fechaStr) : new Date();
  switch (tipo) {
    case 'extra_diurna': return 0.25;
    case 'extra_nocturna': return 0.75;
    case 'recargo_nocturno': return 0.35;
    case 'recargo_dominical':
      if (fecha >= DOM_AUM_100) return 1.00;
      if (fecha >= DOM_AUM_90) return 0.90;
      if (fecha >= DOM_AUM_80) return 0.80;
      return 0.75;
    case 'recargo_noct_dom': return 1.10;
    case 'extra_dom_diurna': return 1.00;
    case 'extra_dom_nocturna': return 1.50;
    default: return 0;
  }
}

/* ------- BLOQUES UI ------- */
function addBlock(contract) {
  const map = {
    'indef': 'blocks-indef', 'fijo': 'blocks-fijo', 'obra': 'blocks-obra', 'horas': 'blocks-horas'
  };
  const containerId = map[contract];
  if (!containerId) return;
  const container = el(containerId);
  const wrapper = document.createElement('div');
  wrapper.className = 'rec-block';
  wrapper.innerHTML = `
    <select class="rec-tipo">
      <option value="extra_diurna">Hora extra diurna (25%)</option>
      <option value="extra_nocturna">Hora extra nocturna (75%)</option>
      <option value="recargo_nocturno">Recargo nocturno (35%)</option>
      <option value="recargo_dominical">Recargo dominical/festivo (75%→80/90/100)</option>
      <option value="recargo_noct_dom">Recargo nocturno + dominical (110%)</option>
      <option value="extra_dom_diurna">Hora extra dominical diurna (100%)</option>
      <option value="extra_dom_nocturna">Hora extra dominical nocturna (150%)</option>
    </select>
    <label>Inicio <input type="time" class="rec-inicio"></label>
    <label>Fin <input type="time" class="rec-fin"></label>
    <button type="button" class="remove-btn">✖</button>
  `;
  container.appendChild(wrapper);
  wrapper.querySelector('.remove-btn').addEventListener('click', () => wrapper.remove());
}

/* ------- FUNCION LIMPIAR PANEL ------- */
function clearPanel(contract) {
  const form = document.querySelector(`#${contract} .form`);
  if (form) form.reset();
  const blocksContainer = document.getElementById(`blocks-${contract}`);
  if (blocksContainer) blocksContainer.innerHTML = '';
  const output = document.getElementById(`out-${contract}`);
  if (output) output.innerHTML = '';
  // Limpiar errores visuales
  document.querySelectorAll('.campo-error').forEach(el => {
    el.classList.remove('campo-error');
  });
}

// ✨ NUEVO: Sistema de mensajes globales con enlace para ir al campo
function mostrarMensajeGlobal(mensaje, campoId = null, duracion = 5000) {
  let contenedor = document.getElementById('mensaje-global');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'mensaje-global';
    contenedor.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      max-width: 340px;
      background: #fff5f5;
      border-left: 4px solid #ff6b6b;
      padding: 14px 16px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      color: #c0392b;
      line-height: 1.4;
    `;
    document.body.appendChild(contenedor);
    
    const contenido = document.createElement('div');
    contenido.style.display = 'flex';
    contenido.style.justifyContent = 'space-between';
    contenido.style.alignItems = 'flex-start';
    contenido.style.flexWrap = 'wrap';
    contenido.style.gap = '8px';
    
    const texto = document.createElement('span');
    texto.id = 'mensaje-texto';
    texto.innerHTML = '⚠️ <span></span>';
    
    const botonCerrar = document.createElement('button');
    botonCerrar.id = 'cerrar-mensaje';
    botonCerrar.innerHTML = '×';
    botonCerrar.style.cssText = `
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: #e74c3c;
      padding: 0;
      line-height: 1;
      align-self: flex-start;
    `;
    
    contenido.appendChild(texto);
    contenido.appendChild(botonCerrar);
    contenedor.appendChild(contenido);
  }

  const textoSpan = contenedor.querySelector('#mensaje-texto span');
  const botonCerrar = contenedor.querySelector('#cerrar-mensaje');
  
  if (textoSpan) {
    textoSpan.textContent = mensaje;
    
    // Eliminar enlace anterior si existe
    const enlaceAnterior = contenedor.querySelector('.enlace-campo');
    if (enlaceAnterior) enlaceAnterior.remove();
    
    // Agregar enlace si hay campoId
    if (campoId) {
      const enlace = document.createElement('a');
      enlace.href = '#';
      enlace.className = 'enlace-campo';
      enlace.textContent = 'Ir al campo →';
      enlace.onclick = (e) => {
        e.preventDefault();
        const campo = document.getElementById(campoId);
        if (campo) {
          campo.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => {
            campo.focus();
            if (!campo.classList.contains('campo-error')) {
              campo.classList.add('campo-error');
            }
          }, 300);
        }
        contenedor.style.display = 'none';
      };
      contenedor.querySelector('#mensaje-texto').parentNode.appendChild(enlace);
    }
  }
  
  contenedor.style.display = 'block';

  botonCerrar.onclick = () => {
    contenedor.style.display = 'none';
  };

  clearTimeout(mostrarMensajeGlobal.timer);
  mostrarMensajeGlobal.timer = setTimeout(() => {
    contenedor.style.display = 'none';
  }, duracion);
}

// Validar campos obligatorios por tipo de contrato
function validarCampos(contract) {
  // Limpiar errores previos
  document.querySelectorAll('.campo-error').forEach(el => {
    el.classList.remove('campo-error');
  });

  // Función para resaltar un campo
  const resaltarCampo = (id) => {
    const campo = el(id);
    if (campo) {
      campo.classList.add('campo-error');
      const removerError = () => {
        campo.classList.remove('campo-error');
        campo.removeEventListener('input', removerError);
        campo.removeEventListener('change', removerError);
      };
      campo.addEventListener('input', removerError);
      campo.addEventListener('change', removerError);
    }
  };

  // Función auxiliar para verificar si un campo está vacío
  const req = (id, nombre) => {
    const val = el(id)?.value?.trim();
    if (isEmpty(val)) {
      mostrarMensajeGlobal(`El campo "${nombre}" es obligatorio.`, id);
      resaltarCampo(id);
      return false;
    }
    return true;
  };

  const numReq = (id, nombre) => {
    const val = parseFloat(el(id)?.value);
    if (isNaN(val) || val <= 0) {
      mostrarMensajeGlobal(`El campo "${nombre}" debe ser un número válido mayor que 0.`, id);
      resaltarCampo(id);
      return false;
    }
    return true;
  };

  const dateReq = (id, nombre) => {
    const val = el(id)?.value;
    if (!val) {
      mostrarMensajeGlobal(`El campo "${nombre}" es obligatorio.`, id);
      resaltarCampo(id);
      return false;
    }
    return true;
  };

  switch (contract) {
    case 'indef':
    case 'fijo':
      return req(`empresa-${contract}`, 'Razón social') &&
             req(`nit-${contract}`, 'NIT') &&
             req(`nombre-${contract}`, 'Nombre completo') &&
             req(`id-${contract}`, 'Identificación') &&
             dateReq(`fecha-${contract}`, 'Fecha') &&
             req(`horaInicio-${contract}`, 'Hora inicio jornada') &&
             req(`horaFin-${contract}`, 'Hora fin jornada') &&
             numReq(`salario-${contract}`, 'Salario base mensual');

    case 'obra':
      return req(`empresa-obra`, 'Razón social') &&
             req(`nit-obra`, 'NIT') &&
             req(`nombre-obra`, 'Nombre') &&
             req(`id-obra`, 'Identificación') &&
             dateReq(`fecha-obra`, 'Fecha') &&
             numReq(`salario-obra`, 'Salario base mensual');

    case 'ocas':
      return req(`empresa-ocas`, 'Razón social') &&
             req(`nit-ocas`, 'NIT') &&
             req(`nombre-ocas`, 'Nombre') &&
             req(`id-ocas`, 'Identificación') &&
             dateReq(`fecha-ocas`, 'Fecha') &&
             numReq(`salario-ocas`, 'Valor acordado');

    case 'apren':
      return req(`empresa-apren`, 'Razón social') &&
             req(`nit-apren`, 'NIT') &&
             req(`nombre-apren`, 'Nombre');

    case 'horas':
      return req(`empresa-horas`, 'Razón social') &&
             req(`nit-horas`, 'NIT') &&
             numReq(`valorHora-horas`, 'Valor hora') &&
             numReq(`cantHoras-horas`, 'Cantidad de horas');

    default:
      return true;
  }
}

/* ------- CALCULO PRINCIPAL ------- */
function compute(contract) {
  if (!validarCampos(contract)) {
    return;
  }

  const outEl = el('out-' + contract);
  outEl.innerHTML = '';

  function getVal(id) {
    const node = el(id);
    if (node) {
      if (node.type === 'number') return Number(node.value) || 0;
      return node.value;
    }
    return '';
  }

  const empresa = getVal(`empresa-${contract}`) || '';
  const nit = getVal(`nit-${contract}`) || '';
  const nombre = getVal(`nombre-${contract}`) || '';
  const identificacion = getVal(`id-${contract}`) || '';
  const fecha = getVal(`fecha-${contract}`) || '';

  let salarioMensual = 0;
  let salarioPeriodo = 0;

  if (contract === 'ocas') {
    salarioMensual = Number(el('salario-ocas')?.value || 0);
    salarioPeriodo = salarioMensual;
  } else if (contract === 'apren') {
    const etapa = el('etapa-apren')?.value || 'lectiva';
    salarioMensual = (etapa === 'lectiva' ? SMLV * 0.75 : SMLV);
    salarioPeriodo = salarioMensual;
  } else if (contract === 'horas') {
    salarioMensual = 0;
    salarioPeriodo = 0;
  } else {
    salarioMensual = Number(el(`salario-${contract}`)?.value || 0);
    const periodo = el(`periodo-${contract}`)?.value || 'mensual';
    salarioPeriodo = (periodo === 'quincenal') ? salarioMensual / 2 : salarioMensual;
  }

  let aux = 0;
  const auxCheckbox = el(`chkAux-${contract}`);
  if (contract !== 'apren') {
    if (auxCheckbox && auxCheckbox.checked && salarioMensual > 0 && salarioMensual <= 2 * SMLV) {
      aux = AUX_TRANS;
    }
  } else {
    const etapa = el('etapa-apren')?.value || 'lectiva';
    if (etapa === 'productiva' && auxCheckbox && auxCheckbox.checked && salarioMensual <= 2 * SMLV) {
      aux = AUX_TRANS;
    }
  }

  const horasBaseMes = 220;
  const valorHora = (salarioMensual > 0) ? (salarioMensual / horasBaseMes) : 0;

  const recMap = { 'indef': 'blocks-indef', 'fijo': 'blocks-fijo', 'obra': 'blocks-obra', 'horas': 'blocks-horas' };
  const blocksContainer = recMap[contract] ? el(recMap[contract]) : null;
  const blockEls = blocksContainer ? Array.from(blocksContainer.querySelectorAll('.rec-block')) : [];

  let detalles = [];
  let totalExtras = 0;

  if (contract === 'horas') {
    const valorHoraUser = Number(el('valorHora-horas')?.value || 0);
    const horasTrab = Number(el('cantHoras-horas')?.value || 0);
    const pago = Math.round(horasTrab * valorHoraUser);
    detalles.push({ concept: 'Horas trabajadas', horas: horasTrab, vunit: valorHoraUser, total: pago });
    totalExtras += pago;
  }

  blockEls.forEach(b => {
    const tipo = b.querySelector('.rec-tipo').value;
    const ini = b.querySelector('.rec-inicio').value;
    const fin = b.querySelector('.rec-fin').value;
    const horas = diffHours(ini, fin);
    let vHora = valorHora;
    if (contract === 'horas') vHora = Number(el('valorHora-horas')?.value || 0);
    const pct = pctForType(tipo, fecha);
    const pagoBloque = Math.round(horas * vHora * (1 + pct));
    totalExtras += pagoBloque;
    detalles.push({
      concept: descriptorFor(tipo),
      horas,
      vunit: vHora,
      pct,
      total: pagoBloque,
      raw: { ini, fin, tipo }
    });
  });

  let devengadosBase = (contract === 'ocas') ? salarioPeriodo : (salarioPeriodo + aux);
  const totalDevengado = Math.round(devengadosBase + totalExtras);

  // Prestaciones y seguridad social
  let cesantias = 0, interesesCesantias = 0, prima = 0, vacaciones = 0, descuentos = 0;
  let aportesEmp = {}, totalPrestaciones = 0;

  const cesantiasCheck = el(`cesantias-${contract}`);
  const interesesCheck = el(`intereses-${contract}`);
  const primaCheck = el(`prima-${contract}`);
  const vacacionesCheck = el(`vacaciones-${contract}`);
  const seguridadCheck = el(`seguridad-${contract}`);

  if (['indef', 'fijo', 'obra', 'ocas'].includes(contract)) {
    if (cesantiasCheck && cesantiasCheck.checked) cesantias = Math.round(salarioMensual * 0.0833);
    if (interesesCheck && interesesCheck.checked) interesesCesantias = Math.round(cesantias * 0.01);
    if (primaCheck && primaCheck.checked) prima = Math.round(salarioMensual * 0.0833);
    if (vacacionesCheck && vacacionesCheck.checked) vacaciones = Math.round(salarioMensual * 0.0417);
  } else if (contract === 'apren') {
    const etapa = el('etapa-apren')?.value || 'lectiva';
    if (etapa === 'productiva') {
      if (cesantiasCheck && cesantiasCheck.checked) cesantias = Math.round(salarioMensual * 0.0833);
      if (interesesCheck && interesesCheck.checked) interesesCesantias = Math.round(cesantias * 0.01);
      if (primaCheck && primaCheck.checked) prima = Math.round(salarioMensual * 0.0833);
      if (vacacionesCheck && vacacionesCheck.checked) vacaciones = Math.round(salarioMensual * 0.0417);
    }
  }

  totalPrestaciones = cesantias + interesesCesantias + prima + vacaciones;

  if (seguridadCheck && seguridadCheck.checked) {
    if (['indef', 'fijo', 'obra', 'ocas'].includes(contract)) {
      const descSalud = Math.round(totalDevengado * 0.04);
      const descPension = Math.round(totalDevengado * 0.04);
      descuentos = descSalud + descPension;
      const aporteSaludEmp = Math.round(totalDevengado * 0.085);
      const aportePensionEmp = Math.round(totalDevengado * 0.12);
      const aporteARL = Math.round(totalDevengado * 0.00522);
      const aporteCajaComp = Math.round(totalDevengado * 0.04);
      const aporteParafiscales = Math.round(totalDevengado * 0.09);
      aportesEmp = {
        aporteSaludEmp, aportePensionEmp, aporteARL, aporteCajaComp, aporteParafiscales,
        costoEmpresa: Math.round(totalDevengado + aporteSaludEmp + aportePensionEmp + aporteARL + aporteCajaComp + aporteParafiscales)
      };
    } else if (contract === 'apren') {
      const aporteSaludEmp = Math.round(totalDevengado * 0.085);
      const aporteARL = Math.round(totalDevengado * 0.00522);
      descuentos = 0;
      aportesEmp = {
        aporteSaludEmp, aporteARL,
        costoEmpresa: Math.round(totalDevengado + aporteSaludEmp + aporteARL)
      };
    } else if (contract === 'horas') {
      const descSalud = Math.round(totalDevengado * 0.04);
      const descPension = Math.round(totalDevengado * 0.04);
      descuentos = descSalud + descPension;
      const aporteSaludEmp = Math.round(totalDevengado * 0.085);
      const aportePensionEmp = Math.round(totalDevengado * 0.12);
      const aporteARL = Math.round(totalDevengado * 0.00522);
      aportesEmp = {
        aporteSaludEmp, aportePensionEmp, aporteARL,
        costoEmpresa: Math.round(totalDevengado + aporteSaludEmp + aportePensionEmp + aporteARL)
      };
    }
  }

  const neto = Math.round(totalDevengado - descuentos);

  // Construir HTML del desprendible
  let html = `<div class="receipt"><h3>Desprendible — ${labelContract(contract)}</h3>`;
  html += `<p><strong>Empleado:</strong> ${nombre || 'N/D'} ${identificacion ? '• ID: ' + identificacion : ''}</p>`;
  html += `<p><strong>Empresa:</strong> ${empresa || 'N/D'} ${nit ? '• NIT: ' + nit : ''}</p>`;
  html += `<p><strong>Fecha:</strong> ${fecha || '-'}</p><hr>`;
  html += `<h4>Conceptos salariales (Devengados)</h4>`;
  
  // Mostrar salario del período (mensual o quincenal)
  const periodo = (contract !== 'indef' && contract !== 'fijo') ? '' : 
                  (el(`periodo-${contract}`)?.value === 'quincenal' ? ' (Quincenal)' : ' (Mensual)');
  html += `<p>Salario base${periodo}: ${salarioPeriodo > 0 ? formatMoney(salarioPeriodo) : 'No aplica'}</p>`;
  html += `<p>Auxilio transporte: ${aux > 0 ? formatMoney(aux) : 'No aplica'}</p>`;

  if (detalles.length) {
    html += `<h5>Detalle horas / recargos</h5><table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left"><th>Concepto</th><th>Horas</th><th>V.unit</th><th>Recargo</th><th>Total</th></tr></thead><tbody>`;
    detalles.forEach(d => {
      const recLabel = d.pct !== undefined ? ((d.pct * 100).toFixed(0) + '%') : '-';
      html += `<tr><td>${d.concept}${d.raw ? (' — ' + (d.raw.ini || '') + '→' + (d.raw.fin || '')) : ''}</td><td>${d.horas || '-'}</td><td>${d.vunit ? formatMoney(d.vunit) : '-'}</td><td>${recLabel}</td><td>${formatMoney(d.total || 0)}</td></tr>`;
    });
    html += `</tbody></table>`;
  } else {
    html += `<p>No hay bloques de recargos/horas añadidos.</p>`;
  }

  html += `<p><strong>Total devengado:</strong> ${formatMoney(totalDevengado)}</p>`;

  if (totalPrestaciones > 0) {
    html += `<hr><h4>Prestaciones Sociales</h4>`;
    if (cesantias > 0) html += `<p>Cesantías: ${formatMoney(cesantias)}</p>`;
    if (interesesCesantias > 0) html += `<p>Intereses sobre cesantías: ${formatMoney(interesesCesantias)}</p>`;
    if (prima > 0) html += `<p>Prima de servicios: ${formatMoney(prima)}</p>`;
    if (vacaciones > 0) html += `<p>Vacaciones: ${formatMoney(vacaciones)}</p>`;
    html += `<p><strong>Total prestaciones:</strong> ${formatMoney(totalPrestaciones)}</p>`;
  }

  if (descuentos > 0 || Object.keys(aportesEmp).length > 0) {
    html += `<hr><h4>Seguridad Social</h4>`;
    if (descuentos > 0) {
      html += `<p>Descuentos empleado:</p>`;
      html += `<p style="margin-left: 20px;">• Salud (4%): ${formatMoney(Math.round(totalDevengado * 0.04))}</p>`;
      html += `<p style="margin-left: 20px;">• Pensión (4%): ${formatMoney(Math.round(totalDevengado * 0.04))}</p>`;
      html += `<p><strong>Total descuentos:</strong> ${formatMoney(descuentos)}</p>`;
    }
    if (aportesEmp.costoEmpresa) {
      html += `<p>Aportes empleador:</p>`;
      if (aportesEmp.aporteSaludEmp) html += `<p style="margin-left: 20px;">• Salud (8.5%): ${formatMoney(aportesEmp.aporteSaludEmp)}</p>`;
      if (aportesEmp.aportePensionEmp) html += `<p style="margin-left: 20px;">• Pensión (12%): ${formatMoney(aportesEmp.aportePensionEmp)}</p>`;
      if (aportesEmp.aporteARL) html += `<p style="margin-left: 20px;">• ARL: ${formatMoney(aportesEmp.aporteARL)}</p>`;
      if (aportesEmp.aporteCajaComp) html += `<p style="margin-left: 20px;">• Caja de Compensación (4%): ${formatMoney(aportesEmp.aporteCajaComp)}</p>`;
      if (aportesEmp.aporteParafiscales) html += `<p style="margin-left: 20px;">• Parafiscales (9%): ${formatMoney(aportesEmp.aporteParafiscales)}</p>`;
      html += `<p><strong>Costo total para la empresa:</strong> ${formatMoney(aportesEmp.costoEmpresa)}</p>`;
    }
  }

  html += `<hr><h4>Resumen Final</h4>`;
  html += `<p><strong>Neto a pagar al trabajador:</strong> ${formatMoney(neto)}</p>`;
  if (totalPrestaciones > 0) {
    html += `<p><strong>Total con prestaciones:</strong> ${formatMoney(neto + totalPrestaciones)}</p>`;
  }
  html += `</div>`;

  outEl.innerHTML = html;
}

function descriptorFor(tipo) {
  const map = {
    'extra_diurna': 'Hora extra diurna',
    'extra_nocturna': 'Hora extra nocturna',
    'recargo_nocturno': 'Recargo nocturno',
    'recargo_dominical': 'Recargo dominical/festivo',
    'recargo_noct_dom': 'Recargo nocturno + dominical',
    'extra_dom_diurna': 'Hora extra dominical diurna',
    'extra_dom_nocturna': 'Hora extra dominical nocturna'
  };
  return map[tipo] || tipo;
}

function labelContract(c) {
  const labels = {
    'indef': 'Indefinido',
    'fijo': 'Fijo',
    'obra': 'Obra labor',
    'ocas': 'Ocasional',
    'apren': 'Aprendizaje',
    'horas': 'Por horas'
  };
  return labels[c] || c;
}

/* ------- EXPORTACION A PDF ------- */
function exportPDF(contract) {
  const out = el('out-' + contract);

  if (!out || !out.innerHTML.trim()) {
    mostrarMensajeGlobal('Debe calcular la nómina antes de exportar.');
    return;
  }

  const empresa = el(`empresa-${contract}`)?.value || 'Empresa';
  const nit = el(`nit-${contract}`)?.value || 'NIT';
  const nombre = el(`nombre-${contract}`)?.value || 'Empleado';
  const identificacion = el(`id-${contract}`)?.value || 'ID';
  const fecha = el(`fecha-${contract}`)?.value || new Date().toISOString().split('T')[0];

  const fechaLegible = new Date(fecha).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Desprendible de Nómina</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #333;
      background: #fff;
      padding: 15mm;
      max-width: 210mm;
      margin: 0 auto;
    }
    @media print {
      body { padding: 10mm; }
      .no-print { display: none !important; }
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #2c3e50;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .logo-pdf {
      height: 70px;
      margin-bottom: 8px;
      opacity: 0.95;
      filter: drop-shadow(0 2px 2px rgba(0,0,0,0.05));
    }
    .header h1 {
      color: #2c3e50;
      font-size: 20px;
      margin-bottom: 4px;
    }
    .header p {
      color: #7f8c8d;
      font-size: 13px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .info-col {
      flex: 1;
      min-width: 200px;
    }
    .info-col h3 {
      font-size: 13px;
      color: #2c3e50;
      margin-bottom: 6px;
      border-bottom: 1px solid #ecf0f1;
      padding-bottom: 3px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #bdc3c7;
      padding: 8px 10px;
      text-align: left;
    }
    th {
      background-color: #f8f9fa;
      font-weight: 600;
      color: #2c3e50;
    }
    .totals {
      margin-top: 20px;
      text-align: right;
    }
    .totals p {
      font-size: 13px;
      margin: 4px 0;
    }
    .total-highlight {
      font-weight: bold;
      font-size: 14px;
      color: #27ae60;
      margin-top: 8px;
    }
    .section-title {
      font-size: 14px;
      color: #2c3e50;
      margin: 20px 0 10px;
      padding-bottom: 5px;
      border-bottom: 1px solid #bdc3c7;
    }
    .footer-note {
      margin-top: 25px;
      font-size: 11px;
      color: #7f8c8d;
      text-align: center;
      font-style: italic;
    }
    .no-data {
      color: #95a5a6;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="header">
    <img src="img/ChatGPT Image 25 sept 2025, 02_20_44 a.m..png" alt="Nomina Contigo" class="logo-pdf">
    <h1>DESPRENDIBLE DE NÓMINA</h1>
    <p>Documento oficial de liquidación de pagos — ${fechaLegible}</p>
  </div>

  <div class="info-row">
    <div class="info-col">
      <h3>DATOS DEL EMPLEADOR</h3>
      <p><strong>Razón Social:</strong> ${empresa}</p>
      <p><strong>NIT:</strong> ${nit}</p>
    </div>
    <div class="info-col">
      <h3>DATOS DEL TRABAJADOR</h3>
      <p><strong>Nombre:</strong> ${nombre}</p>
      <p><strong>Identificación:</strong> ${identificacion}</p>
    </div>
  </div>

  ${out.innerHTML.replace(/<div class="receipt">|<\/div>$/g, '')}

  <div class="footer-note">
    Este documento es generado automáticamente. Válido sin firma física. Cálculos según normativa colombiana vigente.
  </div>

  <div class="no-print" style="text-align:center; margin-top:20px;">
    <button onclick="window.print()" style="padding:10px 20px; background:#3498db; color:white; border:none; border-radius:4px; cursor:pointer;">
      🖨️ Imprimir / Guardar como PDF
    </button>
  </div>
</body>
</html>
  `);
  printWindow.document.close();
  printWindow.focus();
}