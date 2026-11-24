from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./vtuwhatnow.db"
    
    # Official VTU Results Entry URLs
    VTU_URL_SEM1: str = "https://results.vtu.ac.in/D25J26Ecbcs/index.php"
    VTU_URL_SEM2: str = "https://results.vtu.ac.in/MJ26cbcs/index.php"
    VTU_URL_MAKEUP: str = "https://results.vtu.ac.in/SME26cbcs/index.php"
    
    # Scraping politeness delays (in seconds)
    DELAY_MIN: int = 2
    DELAY_MAX: int = 3
    
    # CORS - allow all origins by default for seamless Vercel / Render hosting
    ALLOWED_ORIGINS: str = "*"

    # Admin Panel Protection
    ADMIN_PASSWORD: str = "admin"
    SECRET_KEY: str = ""

    # Playwright Concurrency Throttle (active simultaneous browser contexts)
    # Set to 3 for guaranteed safety under Render free tier (512MB RAM cap)
    MAX_CONCURRENT_SCRAPERS: int = 3

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
