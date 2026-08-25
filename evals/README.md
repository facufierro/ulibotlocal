# Visor local de evaluaciones

Desde PowerShell, ejecutar:

```powershell
cd D:\Projects\E-ABC\ulibotlocal
powershell -ExecutionPolicy Bypass -File .\evals\view-results.ps1
```

El comando inicia solamente la base de datos y el backend locales necesarios,
abre `http://localhost:5174/evaluations` y carga la evaluación completa más
reciente del asistente clonado con ID 6.

La pantalla permite elegir ejecuciones anteriores, filtrar casos aprobados o
fallidos y abrir cada caso para comparar la pregunta, la respuesta esperada,
la respuesta real y sus métricas.

Para cerrar el visor, presionar `Ctrl+C` en la terminal. Los contenedores locales
pueden detenerse después con:

```powershell
docker compose stop ulibotback backdb
```
