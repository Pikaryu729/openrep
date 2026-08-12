from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

CONFIG_DIR = Path.home() / ".openrep"


class Settings(BaseSettings):
    # Later entries win. The user-level file is what an installed `openrep`
    # should read; the cwd-relative one is a dev convenience that only fires
    # when running from backend/ — on its own it would mean an installed app
    # picks up whatever .env happens to sit in the user's current directory.
    model_config = SettingsConfigDict(
        env_prefix="OPENREP_",
        env_file=(CONFIG_DIR / ".env", ".env"),
    )

    database_path: Path = CONFIG_DIR / "openrep.db"
    host: str = "127.0.0.1"
    port: int = 8765
    cors_origins: list[str] = ["http://localhost:5173"]

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.database_path}"


settings = Settings()
