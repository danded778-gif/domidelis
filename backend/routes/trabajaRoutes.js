/**
 * ============================================================
 * DOMIDELIS - Ruta API para formulario "Trabaja con nosotros"
 * ============================================================
 * 
 * Archivo: backend/routes/trabajaRoutes.js
 * Resend
 * COMO INTEGRAR EN TU BACKEND:
 * ============================
 * 1. Copia este archivo a: backend/routes/trabajaRoutes.js
 * 
 * 2. En tu backend/server.js, agrega estas lineas:
 * 
 *    const trabajaRoutes = require('./routes/trabajaRoutes');
 *    app.use('/api/trabaja', trabajaRoutes);
 * 
 * 3. CONFIGURACION DEL CORREO DE DESTINO:
 *    OPCION A: En backend/.env agrega:
 *             CORREO_DESTINO=tu-correo@ejemplo.com
 *    
 *    OPCION B: Cambia el valor directamente abajo:
 *             const CORREO_DESTINO = 'tu-correo@ejemplo.com'
 * 
 * 4. INSTALAR DEPENDENCIAS PARA ENVIO REAL DE CORREO:
 *    Elige UNA de estas opciones:
 * 
 *    a) RESEND (Recomendado - 100 emails/dia gratis):
 *       npm install resend
 *       Descomenta la seccion de  abajo
 * 
 *    b) NODEMAILER (Para usar con tu propio SMTP):
 *       npm install nodemailer
 *       Descomenta la seccion de Nodemailer abajo
 * 
 *    c) SENDGRID (100 emails/dia gratis):
 *       npm install @sendgrid/mail
 *       Descomenta la seccion de SendGrid abajo
 * ============================================================
 */

const express = require('express');
const router = express.Router();

// ============================================================
// CONFIGURACION DEL CORREO
// ============================================================
const CORREO_DESTINO = process.env.CORREO_DESTINO || 'solucionventasconfiables@gmail.com';
// ============================================================

// Ruta POST para recibir datos del formulario
router.post('/', async (req, res) => {
    try {
        const { formData, correoDestino, nombreCompleto } = req.body;
        const destino = correoDestino || CORREO_DESTINO;

        // ============================================================
        // OPCION A: RESEND (https://resend.com)
        // Descomenta esta seccion e instala: npm install resend
        // ============================================================
        
        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

        await resend.emails.send({
            from: 'DOMIDELIS <noreply@domidelis.top>',
            to: [destino],
            subject: `Nueva aplicacion de domiciliario: ${nombreCompleto}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #f97316;">Nueva Aplicacion de Domiciliario</h2>
                    <p><strong>Nombre:</strong> ${nombreCompleto}</p>
                    <p><strong>Documento:</strong> ${formData.tipoDocumento} ${formData.numeroDocumento}</p>
                    <p><strong>Telefono:</strong> ${formData.telefono}</p>
                    <p><strong>Correo:</strong> ${formData.correo}</p>
                    <p><strong>Moto propia:</strong> ${formData.tieneMoto === 'si' ? 'Si' : 'No'}</p>
                    <p><strong>Experiencia:</strong> ${formData.tieneExperiencia === 'si' ? 'Si - ' + formData.anosExperiencia + ' anos' : 'No'}</p>
                    <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-CO')}</p>
                    <hr style="margin: 20px 0; border-color: #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 12px;">DOMIDELIS - Sistema de aplicaciones</p>
                </div>
            `
            
        });
       


        // ============================================================
        // OPCION B: NODEMAILER (SMTP propio)
        // Descomenta esta seccion e instala: npm install nodemailer
        // ============================================================
        /*
        const nodemailer = require('nodemailer');

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        await transporter.sendMail({
            from: `"DOMIDELIS" <${process.env.SMTP_USER}>`,
            to: destino,
            subject: `Nueva aplicacion de domiciliario: ${nombreCompleto}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #f97316;">Nueva Aplicacion de Domiciliario</h2>
                    <p><strong>Nombre:</strong> ${nombreCompleto}</p>
                    <p><strong>Documento:</strong> ${formData.tipoDocumento} ${formData.numeroDocumento}</p>
                    <p><strong>Telefono:</strong> ${formData.telefono}</p>
                    <p><strong>Correo:</strong> ${formData.correo}</p>
                    <p><strong>Moto propia:</strong> ${formData.tieneMoto === 'si' ? 'Si' : 'No'}</p>
                    <p><strong>Experiencia:</strong> ${formData.tieneExperiencia === 'si' ? 'Si - ' + formData.anosExperiencia + ' anos' : 'No'}</p>
                    <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-CO')}</p>
                </div>
            `,
        });
        */

        // ============================================================
        // OPCION C: SENDGRID
        // Descomenta esta seccion e instala: npm install @sendgrid/mail
        // ============================================================
        /*
        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);

        await sgMail.send({
            to: destino,
            from: 'noreply@tudominio.com',
            subject: `Nueva aplicacion de domiciliario: ${nombreCompleto}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #f97316;">Nueva Aplicacion de Domiciliario</h2>
                    <p><strong>Nombre:</strong> ${nombreCompleto}</p>
                    <p><strong>Documento:</strong> ${formData.tipoDocumento} ${formData.numeroDocumento}</p>
                    <p><strong>Telefono:</strong> ${formData.telefono}</p>
                    <p><strong>Correo:</strong> ${formData.correo}</p>
                    <p><strong>Moto propia:</strong> ${formData.tieneMoto === 'si' ? 'Si' : 'No'}</p>
                    <p><strong>Experiencia:</strong> ${formData.tieneExperiencia === 'si' ? 'Si - ' + formData.anosExperiencia + ' anos' : 'No'}</p>
                    <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-CO')}</p>
                </div>
            `,
        });
        */

        // Registro en consola (modo desarrollo - simula envio)
        console.log('========================================');
        console.log('NUEVA APLICACION DE DOMICILIARIO');
        console.log('========================================');
        console.log(`Correo destino: ${destino}`);
        console.log(`Nombre: ${nombreCompleto}`);
        console.log(`Documento: ${formData.tipoDocumento} ${formData.numeroDocumento}`);
        console.log(`Telefono: ${formData.telefono}`);
        console.log(`Correo: ${formData.correo}`);
        console.log(`Moto propia: ${formData.tieneMoto === 'si' ? 'Si' : 'No'}`);
        console.log(`Experiencia: ${formData.tieneExperiencia === 'si' ? 'Si' : 'No'}`);
        if (formData.tieneExperiencia === 'si') {
            console.log(`Anos de experiencia: ${formData.anosExperiencia}`);
            console.log(`Empresa anterior: ${formData.empresaAnterior || 'N/A'}`);
        }
        console.log(`Fecha: ${new Date().toLocaleString('es-CO')}`);
        console.log('========================================');

        res.json({
            success: true,
            message: `Aplicacion registrada. Se enviara copia a ${destino}`,
            destino,
        });

    } catch (error) {
        console.error('Error al procesar la aplicacion:', error);
        res.status(500).json({
            success: false,
            message: 'Error al procesar la aplicacion',
        });
    }
});

module.exports = router;
