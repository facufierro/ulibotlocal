# Visor local de evaluaciones

Desde PowerShell, ejecutar:

```powershell
cd D:\Projects\E-ABC\ulibotlocal
powershell -ExecutionPolicy Bypass -File .\evals\view-results.ps1
```

El comando inicia la base de datos, el backend y el worker de evaluación
locales, espera a que la API esté disponible y abre
`http://localhost:5174/evaluations`.

La pantalla permite seleccionar un asistente y un dataset, revisar o editar el
prompt sin guardarlo, ejecutar una evaluación, seguir su progreso y revisar por
separado el modelo, el prompt y cada respuesta real. Una versión editada del
prompt se guarda solo como snapshot de la ejecución y nunca modifica el
asistente.

Para cerrar el visor, presionar `Ctrl+C` en la terminal. Los contenedores locales
pueden detenerse después con:

```powershell
docker compose stop ulibotback backdb
```
