
# Add dashboard redirect
from fastapi.responses import RedirectResponse

@main.app.get("/")
async def root():
    return RedirectResponse(url="/dashboard/index.html")
