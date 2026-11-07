from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./vtuwhatnow.db"
    
    # Official VTU Results Entry URLs
    VTU_URL_SEM1: str = "https://results.vtu.ac.in/D25J26Ecbcs/index.php"
    VTU_URL_SEM2: str = "https://results.vtu.ac.in/MJ26cbcs/index.php"
    
    # Scraping politeness delays (in seconds)
    DELAY_MIN: int = 5
    DELAY_MAX: int = 10
    
    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Admin Panel Protection
    ADMIN_PASSWORD: str = "admin123"

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
