/**
 * ============================================================
 * DOMIDELIS - Formulario "Quieres trabajar con nosotros?"
 * ============================================================
 * 
 * Archivo: frontend/assets/js/trabaja.js
 * 
 * CONFIGURACION DEL CORREO DE DESTINO:
 * ====================================
 * Para cambiar el correo donde se envia la copia del PDF:
 * 
 * OPCION 1: Cambiar directamente aqui abajo
 *   Cambia: 'soluvencon@gmail.com' por tu correo
 * 
 * OPCION 2: Configurar en el backend
 *   Archivo: backend/routes/trabajaRoutes.js
 *   Busca: CORREO_DESTINO y cambialo
 * 
 * OPCION 3: Variable de entorno en el backend
 *   En backend/.env agrega: CORREO_DESTINO=tu-correo@ejemplo.com
 * ============================================================
 */

const CORREO_DESTINO = 'soluvencon@gmail.com';

// ==============================
// ESTADO DEL FORMULARIO
// ==============================
let currentStep = 1;
const totalSteps = 4;
let fotoPreview = null;
let fotoFile = null;
let isSubmitting = false;
let redirectTimer = null;

// ==============================
// ELEMENTOS DEL DOM
// ==============================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const stepSections = {
    1: $('#step-1'),
    2: $('#step-2'),
    3: $('#step-3'),
    4: $('#step-4'),
};

const btnPrev = $('#btn-prev');
const btnNext = $('#btn-next');
const btnSubmit = $('#btn-submit');
const progressFill = $('#progress-fill');
const stepLabel = $('#step-label');
const stepPercent = $('#step-percent');
const stepDots = $$('.step-dot');
const uploadZone = $('#upload-zone');
const photoPreview = $('#photo-preview');
const previewImage = $('#preview-image');
const fotoInput = $('#foto-input');
const removePhoto = $('#remove-photo');
const changePhoto = $('#change-photo');
const noMotoScreen = $('#no-moto-screen');
const successScreen = $('#success-screen');
const formNav = $('#form-nav');
const expFields = $('#exp-fields');

// ==============================
// NAVEGACION DE PASOS
// ==============================
function showStep(step) {
    // Ocultar todos los pasos
    Object.values(stepSections).forEach(s => s.classList.add('hidden'));
    
    // Mostrar paso actual
    if (stepSections[step]) {
        stepSections[step].classList.remove('hidden');
    }

    // Actualizar barra de progreso
    const percent = Math.round((step / totalSteps) * 100);
    progressFill.style.width = percent + '%';
    stepLabel.textContent = `Paso ${step} de ${totalSteps}`;
    stepPercent.textContent = percent + '%';

    // Actualizar indicadores
    stepDots.forEach(dot => {
        const dotStep = parseInt(dot.dataset.step);
        if (dotStep <= step) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });

    // Botones de navegacion
    btnPrev.disabled = step === 1;
    
    if (step === totalSteps) {
        btnNext.classList.add('hidden');
        btnSubmit.classList.remove('hidden');
    } else {
        btnNext.classList.remove('hidden');
        btnSubmit.classList.add('hidden');
    }

    // Actualizar resumen en paso 4
    if (step === 4) {
        updateSummary();
    }

    // Scroll arriba
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextStep() {
    if (!validateStep(currentStep)) return;
    
    if (currentStep < totalSteps) {
        currentStep++;
        showStep(currentStep);
    }
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        showStep(currentStep);
    }
}

// ==============================
// VALIDACIONES
// ==============================
function validateField(name, value) {
    switch (name) {
        case 'primerNombre':
        case 'primerApellido':
        case 'segundoApellido':
            if (!value || !value.trim()) return 'Este campo es obligatorio';
            if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(value.trim())) return 'Solo se permiten letras';
            if (value.trim().length < 2) return 'Minimo 2 caracteres';
            return '';
        case 'segundoNombre':
            if (value && value.trim() && !/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(value.trim())) return 'Solo se permiten letras';
            return '';
        case 'tipoDocumento':
            if (!value) return 'Selecciona un tipo de documento';
            return '';
        case 'numeroDocumento':
            if (!value || !value.trim()) return 'Este campo es obligatorio';
            if (!/^[0-9]+$/.test(value.trim())) return 'Solo se permiten numeros';
            return '';
        case 'fechaNacimiento':
            if (!value) return 'Este campo es obligatorio';
            const fecha = new Date(value);
            const hoy = new Date();
            let edad = hoy.getFullYear() - fecha.getFullYear();
            const mesDiff = hoy.getMonth() - fecha.getMonth();
            if (mesDiff < 0 || (mesDiff === 0 && hoy.getDate() < fecha.getDate())) edad--;
            if (edad < 18) return 'Debes ser mayor de 18 anos';
            return '';
        case 'telefono':
            if (!value || !value.trim()) return 'Este campo es obligatorio';
            if (!/^[\d\s\-\+\(\)]{7,15}$/.test(value.trim())) return 'Formato de telefono no valido';
            return '';
        case 'correo':
            if (!value || !value.trim()) return 'Este campo es obligatorio';
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Correo electronico no valido';
            return '';
        case 'direccion':
            if (!value || !value.trim()) return 'Este campo es obligatorio';
            return '';
        case 'tieneMoto':
            if (!value) return 'Debes seleccionar una opcion';
            return '';
        case 'tieneExperiencia':
            if (!value) return 'Debes seleccionar una opcion';
            return '';
        case 'anosExperiencia':
            if (!value || !value.trim()) return 'Este campo es obligatorio';
            if (!/^[0-9]+$/.test(value.trim())) return 'Solo numeros';
            return '';
        default:
            return '';
    }
}

function showFieldError(name, message) {
    const errorEl = $(`#error-${name}`);
    const inputEl = $(`#${name}`);
    if (errorEl) errorEl.textContent = message;
    if (inputEl) {
        if (message) {
            inputEl.classList.add('error');
            inputEl.classList.remove('valid');
        } else {
            inputEl.classList.remove('error');
            inputEl.classList.add('valid');
        }
    }
}

function validateStep(step) {
    let valid = true;

    if (step === 1) {
        const fields = ['primerNombre', 'segundoNombre', 'primerApellido', 'segundoApellido', 
                        'tipoDocumento', 'numeroDocumento', 'fechaNacimiento', 
                        'telefono', 'correo', 'direccion'];
        fields.forEach(field => {
            const el = $(`#${field}`);
            const value = el ? el.value : '';
            const error = validateField(field, value);
            showFieldError(field, error);
            if (error) valid = false;
        });
    }

    if (step === 2) {
        if (!fotoPreview) {
            showFieldError('foto', 'La foto es obligatoria');
            valid = false;
        } else {
            showFieldError('foto', '');
        }
    }

    if (step === 3) {
        const motoValue = document.querySelector('input[name="tieneMoto"]:checked');
        const error = validateField('tieneMoto', motoValue ? motoValue.value : '');
        showFieldError('tieneMoto', error);
        if (error) valid = false;
    }

    if (step === 4) {
        const expValue = document.querySelector('input[name="tieneExperiencia"]:checked');
        const error = validateField('tieneExperiencia', expValue ? expValue.value : '');
        showFieldError('tieneExperiencia', error);
        if (error) valid = false;

        if (expValue && expValue.value === 'si') {
            const anosEl = $('#anosExperiencia');
            const anosError = validateField('anosExperiencia', anosEl ? anosEl.value : '');
            showFieldError('anosExperiencia', anosError);
            if (anosError) valid = false;
        }

        const certifica = $('#certificaInfo');
        if (!certifica || !certifica.checked) {
            showFieldError('certificaInfo', 'Debes certificar que la informacion es veridica');
            valid = false;
        } else {
            showFieldError('certificaInfo', '');
        }
    }

    return valid;
}

// Validacion en tiempo real
function setupRealTimeValidation() {
    const fields = ['primerNombre', 'segundoNombre', 'primerApellido', 'segundoApellido',
                    'numeroDocumento', 'fechaNacimiento', 'telefono', 'correo', 'direccion'];
    
    fields.forEach(field => {
        const el = $(`#${field}`);
        if (el) {
            el.addEventListener('blur', () => {
                const error = validateField(field, el.value);
                showFieldError(field, error);
            });
            el.addEventListener('input', () => {
                if (el.classList.contains('error')) {
                    const error = validateField(field, el.value);
                    showFieldError(field, error);
                }
            });
        }
    });

    // Tipo documento
    const tipoDoc = $('#tipoDocumento');
    if (tipoDoc) {
        tipoDoc.addEventListener('change', () => {
            const error = validateField('tipoDocumento', tipoDoc.value);
            showFieldError('tipoDocumento', error);
        });
    }
}

// ==============================
// SUBIDA DE FOTO
// ==============================
async function handlePhotoClick() {
    try {
        // Verificar permisos de almacenamiento
        if (navigator.permissions) {
            try {
                const result = await navigator.permissions.query({ name: 'storage-access' });
                if (result.state === 'denied') {
                    alert('Necesitamos acceso a tu almacenamiento para subir la foto. Por favor, habilita los permisos en la configuracion de tu navegador.');
                    return;
                }
            } catch (e) {
                // Navegador no soporta storage-access, continuamos
            }
        }

        // Tambien verificar permiso de camara
        if (navigator.permissions) {
            try {
                const camResult = await navigator.permissions.query({ name: 'camera' });
                if (camResult.state === 'denied') {
                    alert('Necesitamos acceso para seleccionar una foto. Por favor, habilita los permisos en la configuracion de tu navegador.');
                    return;
                }
            } catch (e) {
                // Continuamos
            }
        }

        fotoInput.click();
    } catch (e) {
        fotoInput.click();
    }
}

function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
        showFieldError('foto', 'Solo se permiten archivos JPG o PNG');
        return;
    }

    // Validar tamano (5MB)
    if (file.size > 5 * 1024 * 1024) {
        showFieldError('foto', 'La imagen no debe superar 5MB');
        return;
    }

    fotoFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
        fotoPreview = ev.target.result;
        previewImage.src = fotoPreview;
        uploadZone.classList.add('hidden');
        photoPreview.classList.remove('hidden');
        showFieldError('foto', '');
    };
    reader.readAsDataURL(file);
}

function removePhotoFn() {
    fotoPreview = null;
    fotoFile = null;
    fotoInput.value = '';
    previewImage.src = '';
    photoPreview.classList.add('hidden');
    uploadZone.classList.remove('hidden');
}

// Drag and drop
function setupDragDrop() {
    if (!uploadZone) return;

    ['dragenter', 'dragover'].forEach(evt => {
        uploadZone.addEventListener(evt, (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = 'var(--primary)';
            uploadZone.style.background = 'var(--primary-light)';
        });
    });

    ['dragleave', 'drop'].forEach(evt => {
        uploadZone.addEventListener(evt, (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = '';
            uploadZone.style.background = '';
        });
    });

    uploadZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fotoInput.files = files;
            handleFileChange({ target: { files } });
        }
    });
}

// ==============================
// MOTO - LOGICA
// ==============================
function setupMotoLogic() {
    const motoSi = $('#moto-si');
    const motoNo = $('#moto-no');

    if (motoSi) {
        motoSi.addEventListener('change', () => {
            if (motoSi.checked) {
                // Tiene moto, continuar normal
                if (redirectTimer) {
                    clearInterval(redirectTimer);
                    redirectTimer = null;
                }
            }
        });
    }

    if (motoNo) {
        motoNo.addEventListener('change', () => {
            if (motoNo.checked) {
                // No tiene moto - mostrar pantalla de rechazo
                showNoMotoScreen();
            }
        });
    }
}

function showNoMotoScreen() {
    // Ocultar el paso 3 y mostrar pantalla de no moto
    stepSections[3].classList.add('hidden');
    noMotoScreen.classList.remove('hidden');
    formNav.classList.add('hidden');

    let countdown = 3;
    const countdownEl = $('#countdown');
    countdownEl.textContent = countdown;

    redirectTimer = setInterval(() => {
        countdown--;
        countdownEl.textContent = countdown;
        if (countdown <= 0) {
            clearInterval(redirectTimer);
            window.location.href = '../';
        }
    }, 1000);
}

// ==============================
// EXPERIENCIA
// ==============================
function setupExperienciaLogic() {
    const expSi = $('#exp-si');
    const expNo = $('#exp-no');

    if (expSi) {
        expSi.addEventListener('change', () => {
            if (expSi.checked) {
                expFields.classList.remove('hidden');
            }
        });
    }

    if (expNo) {
        expNo.addEventListener('change', () => {
            if (expNo.checked) {
                expFields.classList.add('hidden');
            }
        });
    }
}

// ==============================
// RESUMEN
// ==============================
function updateSummary() {
    const data = getFormData();
    const tipoDocNombre = {
        CC: 'Cedula de Ciudadania',
        CE: 'Cedula de Extranjeria',
        PA: 'Pasaporte'
    };

    const content = $('#summary-content');
    if (!content) return;

    content.innerHTML = `
        <p><span class="label">Nombre:</span> ${[data.primerNombre, data.segundoNombre, data.primerApellido, data.segundoApellido].filter(Boolean).join(' ')}</p>
        <p><span class="label">Documento:</span> ${tipoDocNombre[data.tipoDocumento] || data.tipoDocumento} ${data.numeroDocumento}</p>
        <p><span class="label">Moto propia:</span> ${data.tieneMoto === 'si' ? 'Si' : 'No'}</p>
        <p><span class="label">Experiencia:</span> ${data.tieneExperiencia === 'si' ? 'Si' : 'No'}</p>
        <p><span class="label">Foto:</span> ${fotoPreview ? 'Cargada' : 'No cargada'}</p>
    `;
}

// ==============================
// OBTENER DATOS DEL FORMULARIO
// ==============================
function getFormData() {
    const motoChecked = document.querySelector('input[name="tieneMoto"]:checked');
    const expChecked = document.querySelector('input[name="tieneExperiencia"]:checked');

    return {
        primerNombre: $('#primerNombre')?.value || '',
        segundoNombre: $('#segundoNombre')?.value || '',
        primerApellido: $('#primerApellido')?.value || '',
        segundoApellido: $('#segundoApellido')?.value || '',
        tipoDocumento: $('#tipoDocumento')?.value || '',
        numeroDocumento: $('#numeroDocumento')?.value || '',
        fechaNacimiento: $('#fechaNacimiento')?.value || '',
        telefono: $('#telefono')?.value || '',
        correo: $('#correo')?.value || '',
        direccion: $('#direccion')?.value || '',
        tieneMoto: motoChecked ? motoChecked.value : '',
        tieneExperiencia: expChecked ? expChecked.value : '',
        anosExperiencia: $('#anosExperiencia')?.value || '',
        empresaAnterior: $('#empresaAnterior')?.value || '',
        referenciaNombre: $('#referenciaNombre')?.value || '',
        referenciaTelefono: $('#referenciaTelefono')?.value || '',
    };
}

// ==============================
// GENERAR PDF
// ==============================
function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const data = getFormData();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;

    const tipoDocNombre = {
        CC: 'Cedula de Ciudadania',
        CE: 'Cedula de Extranjeria',
        PA: 'Pasaporte'
    };

    // Encabezado
    doc.setFontSize(22);
    doc.setTextColor(41, 98, 255);
    doc.text('Hoja de Vida - Domiciliario', pageWidth / 2, y, { align: 'center' });
    y += 12;

    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(`Fecha de aplicacion: ${new Date().toLocaleDateString('es-CO')}`, pageWidth / 2, y, { align: 'center' });
    y += 15;

    // Linea separadora
    doc.setDrawColor(41, 98, 255);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Datos personales
    doc.setFontSize(14);
    doc.setTextColor(41, 98, 255);
    doc.text('Datos Personales', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);

    const nombreCompleto = [data.primerNombre, data.segundoNombre, data.primerApellido, data.segundoApellido].filter(Boolean).join(' ');

    const personalFields = [
        ['Nombre completo', nombreCompleto],
        ['Tipo de documento', tipoDocNombre[data.tipoDocumento] || data.tipoDocumento],
        ['Numero de documento', data.numeroDocumento],
        ['Fecha de nacimiento', data.fechaNacimiento],
        ['Telefono', data.telefono],
        ['Correo electronico', data.correo],
        ['Direccion', data.direccion],
    ];

    personalFields.forEach(([label, value]) => {
        doc.setFont(undefined, 'bold');
        doc.text(`${label}:`, margin, y);
        doc.setFont(undefined, 'normal');
        doc.text(value || 'N/A', margin + 60, y);
        y += 7;
    });

    y += 5;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Informacion de vehiculo
    doc.setFontSize(14);
    doc.setTextColor(41, 98, 255);
    doc.text('Informacion de Vehiculo', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.setFont(undefined, 'bold');
    doc.text('Tiene moto propia:', margin, y);
    doc.setFont(undefined, 'normal');
    doc.text(data.tieneMoto === 'si' ? 'Si' : 'No', margin + 60, y);
    y += 10;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Experiencia laboral
    doc.setFontSize(14);
    doc.setTextColor(41, 98, 255);
    doc.text('Experiencia Laboral', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);

    const expFields = [
        ['Experiencia como domiciliario', data.tieneExperiencia === 'si' ? 'Si' : 'No'],
        ['Anos de experiencia', data.anosExperiencia || 'N/A'],
        ['Empresa anterior', data.empresaAnterior || 'N/A'],
        ['Referencia laboral', data.referenciaNombre || 'N/A'],
        ['Telefono referencia', data.referenciaTelefono || 'N/A'],
    ];

    expFields.forEach(([label, value]) => {
        doc.setFont(undefined, 'bold');
        doc.text(`${label}:`, margin, y);
        doc.setFont(undefined, 'normal');
        doc.text(value, margin + 60, y);
        y += 7;
    });

    // Foto si existe
    if (fotoPreview) {
        try {
            doc.addImage(fotoPreview, 'JPEG', pageWidth - 55, 25, 35, 35);
        } catch (e) {
            // Si falla la imagen, continuamos sin ella
        }
    }

    // Pie de pagina
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('DOMIDELIS - Formulario de aplicacion domiciliario', margin, doc.internal.pageSize.getHeight() - 10);

    // Guardar
    const nombreArchivo = `hoja_vida_${data.primerNombre}_${data.primerApellido}.pdf`;
    doc.save(nombreArchivo);

    return doc;
}

// ==============================
// ENVIAR FORMULARIO
// ==============================
async function handleSubmit() {
    if (!validateStep(currentStep)) return;
    if (isSubmitting) return;

    isSubmitting = true;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="spinner"></span> Enviando...';

    try {
        // Generar PDF
        generatePDF();

        // Enviar datos al backend
        const data = getFormData();
        const nombreCompleto = [data.primerNombre, data.segundoNombre, data.primerApellido, data.segundoApellido].filter(Boolean).join(' ');

                try {
            const response = await fetch('https://prueba-production-b9fb.up.railway.app/api/trabaja', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    formData: data,
                    correoDestino: CORREO_DESTINO,
                    nombreCompleto: nombreCompleto,
                }),
            });

            if (!response.ok) {
                console.warn('El correo no pudo enviarse, pero el PDF se descargo correctamente.');
            }
        } catch (e) {
            console.warn('No se pudo conectar al servidor de correo, pero el PDF se descargo correctamente.');
        }

        // Mostrar pantalla de exito
        Object.values(stepSections).forEach(s => s.classList.add('hidden'));
        noMotoScreen.classList.add('hidden');
        successScreen.classList.remove('hidden');
        formNav.classList.add('hidden');
        $('#success-email-msg').textContent = `Se ha enviado una copia a ${CORREO_DESTINO}. Revisaremos tu aplicacion y te contactaremos pronto.`;

    } catch (error) {
        console.error('Error al enviar:', error);
        alert('Hubo un error al enviar. Intentalo de nuevo.');
    } finally {
        isSubmitting = false;
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Enviar mi aplicacion';
    }
}

// ==============================
// EVENT LISTENERS
// ==============================
function init() {
    // Botones de navegacion
    btnNext.addEventListener('click', nextStep);
    btnPrev.addEventListener('click', prevStep);
    btnSubmit.addEventListener('click', handleSubmit);

    // Boton redirigir (no moto)
    const btnRedirect = $('#btn-redirect');
    if (btnRedirect) {
        btnRedirect.addEventListener('click', () => {
            if (redirectTimer) clearInterval(redirectTimer);
            window.location.href = '../';
        });
    }

    // Boton volver al inicio (exito)
    const btnSuccess = $('#btn-success');
    if (btnSuccess) {
        btnSuccess.addEventListener('click', () => {
            window.location.href = '../';
        });
    }

    // Subida de foto
    if (uploadZone) {
        uploadZone.addEventListener('click', handlePhotoClick);
    }
    if (fotoInput) {
        fotoInput.addEventListener('change', handleFileChange);
    }
    if (removePhoto) {
        removePhoto.addEventListener('click', removePhotoFn);
    }
    if (changePhoto) {
        changePhoto.addEventListener('click', handlePhotoClick);
    }

    // Drag and drop
    setupDragDrop();

    // Validacion en tiempo real
    setupRealTimeValidation();

    // Logica de moto
    setupMotoLogic();

    // Logica de experiencia
    setupExperienciaLogic();

    // Mostrar primer paso
    showStep(1);
}

// Inicializar cuando el DOM este listo
document.addEventListener('DOMContentLoaded', init);
