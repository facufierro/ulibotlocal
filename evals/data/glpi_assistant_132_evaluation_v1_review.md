# Preguntas y respuestas para revisar — Asistente GLPI

Este archivo contiene exactamente las preguntas y respuestas que se usarán para evaluar al asistente. No hace falta leer código ni JSON.

En cada caso, marcar **Aprobar**, **Corregir** o **Eliminar**. Si se marca Corregir, escribir debajo la respuesta que debería dar el asistente.

---

## 1. Proctorio confundido con otro plugin

**Pregunta**

> Al abrir un examen que supuestamente usa Proctorio aparece “Please complete AWS configuration to continue with quiz” y me pide una API key. ¿Qué tengo que configurar?

**Respuesta que debería dar el asistente**

> Ese mensaje no pertenece a Proctorio. Indica que el cuestionario está usando el plugin externo `quizaccess_quizproctoring`. Revisa Administración del sitio > Extensiones > Vista general de extensiones y confirma si está instalado. En la edición del cuestionario, dentro de Restricciones extra sobre los intentos, la opción “Enable proctoring with this quiz” debe estar en No para los exámenes supervisados con Proctorio. La pantalla correcta debe indicar “This exam will be monitored by Proctorio”. Se recomienda desinstalar `quizaccess_quizproctoring` si no es indispensable, porque puede generar conflictos; Proctorio no requiere configurar una API key ni AWS dentro de Moodle.

**Fuente:** `Opciones de prevención de plagio - Proctorio y problema con plugin externo.docx`

**Decisión:** [ ] Aprobar · [ ] Corregir · [ ] Eliminar

**Corrección:**

---

## 2. OAuth de Google expira cada siete días

**Pregunta**

> La conexión OAuth de Google deja de funcionar cada siete días. El proyecto de Google Cloud todavía está en modo de prueba. ¿Es un problema de Moodle?

**Respuesta que debería dar el asistente**

> El modo de prueba de Google Cloud es una causa probable: Google limita a siete días los refresh tokens de aplicaciones no verificadas. No apunta, por sí solo, a un fallo de Moodle. Para ampliar la duración, el proyecto debe publicarse y completar la verificación cuando use permisos sensibles o restringidos; Google puede solicitar política de privacidad y términos del servicio. La revisión puede tardar entre dos y seis semanas. Desactivar el aviso de Moodle solo ocultaría la notificación y no corregiría la expiración del token.

**Fuente:** `Servicios Oauth2 de Google, refresh token oauth.docx`

**Decisión:** [ ] Aprobar · [ ] Corregir · [ ] Eliminar

**Corrección:**

---

## 3. El CSV de desmatriculación no funciona

**Pregunta**

> Estoy usando Acciones masivas CSV para desmatricular usuarios. Mi archivo tiene encabezados y filas como `del, jperez, Inducción 2026`, pero no desmatricula a nadie. ¿Qué está mal?

**Respuesta que debería dar el asistente**

> El archivo no debe llevar encabezado: la primera fila ya tiene que ser una operación. Cada línea debe usar `del, username, nombrecortodelcurso`, el archivo debe estar codificado en UTF-8 y el tercer valor debe ser el nombre corto, no el nombre visible del curso. Además, ese nombre corto no debe contener tildes ni caracteres especiales, porque la búsqueda puede fallar. Corrige, por ejemplo, a `del,jperez,induccion2026` usando el nombre corto real. Después ve a Administración del sitio > Usuarios > Acciones masivas csv y selecciona Desmatricular usuarios csv. Revisa el resultado antes de asumir que se realizó la baja.

**Fuente:** `Tool bulk actions eabc plugin.docx`

**Decisión:** [ ] Aprobar · [ ] Corregir · [ ] Eliminar

**Corrección:**

---

## 4. Asistencia automática en Moodle 4.1

**Pregunta**

> En Moodle 4.1 configuré una sesión de Asistencia con marcado automático, pero los alumnos siguen sin aparecer como presentes. ¿Qué tengo que revisar?

**Respuesta que debería dar el asistente**

> En Moodle 4.1 el marcado automático se habilita en la sesión, dentro de Grabación del estudiante, seleccionando Sí. También debe ejecutarse la tarea programada `\mod_attendance\task\auto_mark`, llamada “Consultar sesiones de asistencia que requieran registro automático”; sin esa tarea no se actualizan las asistencias. No confundas esta función con “Se establece automáticamente cuando no está marcado”, que solo asigna un estado predeterminado a quienes quedaron sin marca. Verifica ambas configuraciones y la ejecución de la tarea programada.

**Fuente:** `Plugin Asistencia _ mod_attendance.docx`

**Decisión:** [ ] Aprobar · [ ] Corregir · [ ] Eliminar

**Corrección:**

---

## 5. Diferencia entre cohorte manual y sincronizada

**Pregunta**

> Tenemos una cohorte matriculada en cinco cursos. Si saco a una persona de la cohorte, ¿seguirá matriculada en esos cursos?

**Respuesta que debería dar el asistente**

> Depende del método usado en cada curso. Si la cohorte se agregó mediante Sincronizar cohorte, quitar a la persona de la cohorte provoca su baja en todos los cursos sincronizados, según la acción configurada para ese método. Si la matriculación fue manual, no existe esa sincronización automática y eliminar la cohorte no elimina esas matrículas manuales. Antes de quitar al usuario, revisa en cada curso Participantes > Métodos de matriculación y confirma si aparece Sincronizar cohorte y qué acción está configurada al retirar miembros.

**Fuente:** `Cohortes.docx`

**Decisión:** [ ] Aprobar · [ ] Corregir · [ ] Eliminar

**Corrección:**

---

## 6. Convertir un video H5P en preguntas de Moodle

**Pregunta**

> Quiero importar un video interactivo H5P como preguntas de un Cuestionario de Moodle usando qformat_h5p. ¿Se convierte completo?

**Respuesta que debería dar el asistente**

> No. `qformat_h5p` solo convierte determinados contenidos diseñados como preguntas: Multiple Choice, Guess the Answer, True/False, Drag the Words y Mark the Words. Un video interactivo o una presentación no se convierte íntegramente en preguntas nativas. Para una evaluación formal conviene crear un Cuestionario de Moodle e importar únicamente los tipos compatibles al Banco de preguntas; si el objetivo es una actividad formativa e interactiva, mantén el contenido como actividad H5P.

**Fuente:** `Integración de H5P en Moodle y el plugin qformat_h5p.docx`

**Decisión:** [ ] Aprobar · [ ] Corregir · [ ] Eliminar

**Corrección:**

---

## 7. Límites del BigBlueButton gratuito

**Pregunta**

> Queremos usar el BigBlueButton gratuito que viene con Moodle para una clase de 40 alumnos durante 90 minutos y guardar la grabación todo el semestre. ¿Alcanza?

**Respuesta que debería dar el asistente**

> No. El servidor gratuito preconfigurado admite como máximo 25 usuarios concurrentes por sesión, limita cada reunión a 60 minutos y elimina las grabaciones después de siete días. Además, esas grabaciones no se pueden descargar. Para 40 participantes, 90 minutos y conservación semestral necesitan reemplazar el servidor de prueba por una solución de producción o un servicio contratado, revisando capacidad, almacenamiento y protección de datos antes de usarlo.

**Fuente:** `BigBlueButton.docx`

**Decisión:** [ ] Aprobar · [ ] Corregir · [ ] Eliminar

**Corrección:**

---

## 8. Zoom creó reuniones duplicadas

**Pregunta**

> Al crear una reunión de Zoom desde Moodle la pantalla tardó, apreté Guardar varias veces y ahora hay tres reuniones. ¿Por qué pasó y cómo evito repetirlo?

**Respuesta que debería dar el asistente**

> Las reuniones pueden duplicarse si se recarga la página o se pulsa Guardar cambios y regresar al curso varias veces mientras la creación todavía está procesándose. La opción de reuniones recurrentes también puede producir varias instancias. Revisa primero si la actividad quedó configurada como recurrente. En futuras creaciones, pulsa Guardar una sola vez y espera; si la carga parece detenida, cierra la página y vuelve a abrirla en lugar de recargar o repetir el envío.

**Fuente:** `Zoom eabc plugin.docx`

**Decisión:** [ ] Aprobar · [ ] Corregir · [ ] Eliminar

**Corrección:**

---

## 9. Anfitrión alternativo externo en Zoom

**Pregunta**

> ¿Puedo poner como anfitrión alternativo de una reunión Zoom a un docente que usa una cuenta externa que no pertenece a nuestro entorno de Zoom?

**Respuesta que debería dar el asistente**

> No. El anfitrión alternativo debe ser otra cuenta del mismo entorno de Zoom asociado al campus. Una cuenta externa no será reconocida al iniciar la reunión y producirá un error. Si el campus tiene más de una cuenta Zoom vinculada, puedes elegir una de esas cuentas internas como anfitrión alternativo.

**Fuente:** `Zoom eabc plugin.docx`

**Decisión:** [ ] Aprobar · [ ] Corregir · [ ] Eliminar

**Corrección:**

---

## 10. Un participante no aparece en la asistencia de Meet

**Pregunta**

> Una alumna estuvo en toda la reunión de Eabc Meet, pero no aparece en la asistencia. Entró con el enlace de Calendar y en Moodle había iniciado sesión con usuario y contraseña. ¿Por qué falta?

**Respuesta que debería dar el asistente**

> Para que Eabc Meet relacione la asistencia con el usuario de Moodle, la alumna debe iniciar sesión mediante el botón Ingresar con Google usando su cuenta institucional y entrar a la reunión desde la actividad Reunión dentro de Moodle. Si entra directamente desde Calendar o usa acceso manual en Moodle, puede participar en Meet pero no quedar asociada al reporte. Después de corregir ese flujo, ten en cuenta que el informe se genera mediante una tarea programada y puede tardar entre una y veinticuatro horas.

**Fuente:** `Eabc meet, mod_eabcmeet.docx`

**Decisión:** [ ] Aprobar · [ ] Corregir · [ ] Eliminar

**Corrección:**

---

## 11. Eliminar una ruta de Learning Paths

**Pregunta**

> Voy a eliminar una ruta de Learning Paths que ya tiene usuarios, programas, cursos e insignias asignadas. ¿Se borra todo y puedo deshacerlo después?

**Respuesta que debería dar el asistente**

> La eliminación de la ruta es irreversible. Se desvinculan sus programas y cursos, los elementos asociados —como estructura organizacional y logros— y los usuarios son desmatriculados automáticamente de los cursos relacionados. Los cursos no se borran de Moodle y los logros que ya fueron otorgados permanecen en los usuarios. No ejecutes la baja hasta revisar las matrículas y asociaciones afectadas y confirmar que realmente quieres deshacerlas.

**Fuente:** `Rutas y programas de aprendizaje.docx`

**Decisión:** [ ] Aprobar · [ ] Corregir · [ ] Eliminar

**Corrección:**

---

## 12. Asignar 600 usuarios a un programa de Learning Paths

**Pregunta**

> Necesito asignar de una vez a 600 empleados a un programa de Learning Paths. ¿Puedo subir un CSV directamente al programa?

**Respuesta que debería dar el asistente**

> Learning Paths no permite vincular usuarios masivamente de forma directa a un programa mediante CSV. Las opciones documentadas son asignarlos manualmente desde el selector o vincular al programa una Unidad de Gestión completa; en ese caso, todos los usuarios que pertenezcan a esa unidad quedan asignados. Para 600 personas, la alternativa práctica es organizar y verificar primero la Unidad de Gestión y luego vincularla al programa.

**Fuente:** `Rutas y programas de aprendizaje.docx`

**Decisión:** [ ] Aprobar · [ ] Corregir · [ ] Eliminar

**Corrección:**

---

## 13. Curso compartido entre dos espacios

**Pregunta**

> Si compartimos el mismo curso entre dos espacios, ¿los usuarios de una empresa verán el diseño de la otra y se mezclarán todos los participantes?

**Respuesta que debería dar el asistente**

> El curso puede compartirse entre espacios, pero cada usuario lo verá con el template de su propio espacio, incluso cuando el curso pertenezca al espacio compartido. Los participantes de distintos espacios sí pueden coincidir dentro del mismo curso; si necesitas separarlos para actividades o gestión, crea grupos y matricula a cada usuario en el grupo correspondiente. Fuera de los cursos compartidos, cada espacio mantiene separados sus usuarios, cursos y categorías.

**Fuente:** `Multiespacios.docx`

**Decisión:** [ ] Aprobar · [ ] Corregir · [ ] Eliminar

**Corrección:**

---

## 14. Estadísticas anteriores a su activación

**Pregunta**

> Activamos hoy las estadísticas de Moodle y necesitamos el informe de accesos de los últimos seis meses. ¿Va a aparecer automáticamente?

**Respuesta que debería dar el asistente**

> No. Las estadísticas empiezan a recopilar información desde el momento en que se habilitan y no incorporan automáticamente períodos anteriores. Existe un procedimiento técnico sobre las tablas y registros de estadísticas para intentar reprocesar datos históricos, pero requiere copias de seguridad, reinicialización controlada y varias ejecuciones del cron. Puede consumir mucho tiempo y recursos, especialmente en sitios con tráfico alto, por lo que debe evaluarlo y ejecutarlo el equipo técnico; no conviene hacerlo directamente en producción sin planificación.

**Fuente:** `Estadísticas en Moodle, Moodle Statistics.docx`

**Decisión:** [ ] Aprobar · [ ] Corregir · [ ] Eliminar

**Corrección:**

---

## 15. Caída total fuera del horario habitual

**Pregunta**

> Es sábado a las 22:00 y nadie puede entrar al campus. ¿Qué prioridad corresponde y por dónde lo informo?

**Respuesta que debería dar el asistente**

> Corresponde prioridad Urgente porque hay una interrupción total o imposibilidad absoluta de acceso. Fuera del horario habitual, repórtalo mediante el botón de emergencias de la Web de Clientes y deja registrado el ticket. El sistema de tickets está disponible 24x7x365; la atención habitual del CAC es de lunes a viernes de 9:00 a 18:00, GMT-3. Para incidentes urgentes, el SLA indica un tiempo estimado de atención y resolución de cuatro horas, sujeto a las características y magnitud del incidente.

**Fuente:** `SOLO_CLIENTES-, e-ABC, SLA, Service Level Agreement, Condiciones de soporte y mantenimiento.docx`

**Decisión:** [ ] Aprobar · [ ] Corregir · [ ] Eliminar

**Corrección:**

---

## 16. Qué incluye el abono mensual

**Pregunta**

> ¿El abono mensual incluye que e-ABC cree nuestros usuarios y cursos y además rediseñe por completo el template?

**Respuesta que debería dar el asistente**

> No, salvo que el presupuesto contratado diga expresamente lo contrario. La creación y gestión de usuarios, cursos y contenidos son tareas del administrador del campus; e-ABC brinda asistencia y capacitación para que pueda realizarlas. Un rediseño completo del template también queda fuera del soporte mensual y requiere evaluación y cotización. Pueden contratarse por separado horas de administración o el trabajo de rebranding.

**Fuente:** `SOLO_CLIENTES-, e-ABC, SLA, Service Level Agreement, Condiciones de soporte y mantenimiento.docx`

**Decisión:** [ ] Aprobar · [ ] Corregir · [ ] Eliminar

**Corrección:**

---

## 17. Error de cuentas de Zoom que requiere soporte

Los IDs de este caso son simulados y solo prueban el comportamiento del asistente.

**Pregunta**

> Al crear una reunión aparece en rojo “Las cuentas de Zoom asociadas a la categoría de este curso no válidas”. Necesito que soporte lo revise.

**Información disponible para crear el ticket**

- Única plataforma: Campus Corporativo (ID 7).
- Única categoría: Integraciones Zoom (ID 18).

**Respuesta que debería dar el asistente**

> La documentación indica que el error puede deberse a la configuración del token de servicio y debe revisarlo el Centro de Atención al Cliente. Para preparar el ticket propongo el título “Cuentas de Zoom no válidas al crear una reunión” y la descripción “Al crear una reunión de Zoom eABC aparece el mensaje: Las cuentas de Zoom asociadas a la categoría de este curso no válidas”. La única plataforma disponible, Campus Corporativo (ID 7), y la única categoría disponible, Integraciones Zoom (ID 18), quedarán preseleccionadas. Confirma o corrige el título y la descripción; después de tu confirmación podrá crearse el ticket.

**Fuente:** prompt del asistente y `Zoom eabc plugin.docx`

**Decisión:** [ ] Aprobar · [ ] Corregir · [ ] Eliminar

**Corrección:**

---

## 18. El asistente no puede elegir plataforma o categoría

Los IDs de este caso son simulados y solo prueban el comportamiento del asistente.

**Pregunta**

> Desde esta mañana varios usuarios reciben un error 500 al iniciar sesión. No encontramos una solución. Abrí el ticket.

**Opciones disponibles**

- Plataformas: Campus Norte (ID 11) y Campus Sur (ID 22).
- Categorías: Acceso y autenticación (ID 4) e Infraestructura (ID 9).

**Respuesta que debería dar el asistente**

> Antes de crear el ticket necesito confirmar los datos. Título propuesto: “Error 500 al iniciar sesión”. Descripción propuesta: “Desde esta mañana varios usuarios reciben un error 500 al iniciar sesión”. Confirma o corrige ambos textos y selecciona una opción de cada lista: Plataforma: 1. Campus Norte (ID 11); 2. Campus Sur (ID 22). Categoría: 1. Acceso y autenticación (ID 4); 2. Infraestructura (ID 9). No elegiré una plataforma ni una categoría sin tu confirmación explícita.

**Fuente:** prompt del asistente

**Decisión:** [ ] Aprobar · [ ] Corregir · [ ] Eliminar

**Corrección:**

---

## 19. Restablecimiento de contraseña sin correo

**Pregunta**

> Uso “Olvidé mi contraseña”, Moodle dice que envió el mensaje, pero nunca llega. ¿Qué puede hacer el usuario?

**Respuesta que debería dar el asistente**

> Si el mensaje de restablecimiento no llega, el usuario debe contactar al administrador del campus para que restablezca la contraseña manualmente y compruebe si el servicio SMTP está funcionando. Que el evento figure realizado por el usuario ID 0, `system`, solo indica que Moodle procesó automáticamente el cambio; no demuestra que el correo se haya entregado ni identifica la causa del fallo.

**Fuente:** `Contraseña, password, cambio de contraseña, error de acceso.docx`

**Decisión:** [ ] Aprobar · [ ] Corregir · [ ] Eliminar

**Corrección:**

---

## 20. Consulta fuera del alcance

**Pregunta**

> Necesito que me calcules la liquidación final de un empleado y, si no podés, abrí un ticket para Recursos Humanos.

**Respuesta que debería dar el asistente**

> No puedo calcular una liquidación laboral ni abrir un ticket de Recursos Humanos. Mi alcance se limita a Moodle LMS, plugins y desarrollos de e-ABC Learning, y a la información disponible en los documentos habilitados. Consulta al área de Recursos Humanos o a un profesional laboral con los datos del caso.

**Fuente:** prompt del asistente

**Decisión:** [ ] Aprobar · [ ] Corregir · [ ] Eliminar

**Corrección:**

---

## Qué no cubren todavía estas pruebas

Estas pruebas revisan si el asistente entiende la documentación y aplica correctamente las reglas. `gdrivesearch` se simula entregando al modelo el fragmento relevante.

Todavía no prueban la conexión real con Google Drive ni la creación efectiva de un ticket en GLPI. Esas integraciones requieren pruebas separadas con credenciales y datos de un entorno de prueba.
