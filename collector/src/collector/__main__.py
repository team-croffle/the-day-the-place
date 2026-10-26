import logging

from collector.log import configure_logging
from collector.pipeline import run
from collector.settings import load_settings


def main() -> None:
    settings = load_settings()
    configure_logging(settings.log_level)
    try:
        run(settings)
    except Exception:
        logging.exception("수집이 중단되었다")
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
