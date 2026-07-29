import logging
import json
import os
import sys
from datetime import datetime

# Map log level names to logging constants
LOG_LEVELS = {
    "trace": logging.DEBUG,
    "debug": logging.DEBUG,
    "info": logging.INFO,
    "warn": logging.WARNING,
    "error": logging.ERROR,
    "critical": logging.CRITICAL
}

log_level_str = os.getenv("LOG_LEVEL", "info").lower()
log_level = LOG_LEVELS.get(log_level_str, logging.INFO)

is_prod = os.getenv("NODE_ENV") == "production"

class CustomJSONFormatter(logging.Formatter):
    def format(self, record):
        log_data = {
            "timestamp": datetime.utcfromtimestamp(record.created).isoformat() + "Z",
            "level": record.levelname,
            "message": record.getMessage()
        }
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        if hasattr(record, "extra_data"):
            log_data.update(record.extra_data)
        return json.dumps(log_data)

class ColorFormatter(logging.Formatter):
    COLORS = {
        "DEBUG": "\033[36m",    # Cyan
        "INFO": "\033[32m",     # Green
        "WARNING": "\033[33m",  # Yellow
        "ERROR": "\033[31m",    # Red
        "CRITICAL": "\033[41m\033[37m" # Red background, white text
    }
    RESET = "\033[0m"

    def format(self, record):
        timestamp = datetime.utcfromtimestamp(record.created).isoformat() + "Z"
        level = record.levelname
        color = self.COLORS.get(level, self.RESET)
        message = record.getMessage()
        exc = ""
        if record.exc_info:
            exc = f"\n{self.formatException(record.exc_info)}"
        return f"[{timestamp}] {color}{level}{self.RESET}: {message}{exc}"

def get_logger(name="phantom"):
    logger = logging.getLogger(name)
    logger.setLevel(log_level)
    
    # Avoid duplicate handlers if already configured
    if logger.handlers:
        return logger
        
    # Console Handler
    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(log_level)
    if is_prod:
        ch.setFormatter(CustomJSONFormatter())
    else:
        ch.setFormatter(ColorFormatter())
    logger.addHandler(ch)

    # File Handler (if LOG_PATH is defined)
    log_path = os.getenv("LOG_PATH")
    if log_path:
        try:
            os.makedirs(os.path.dirname(log_path), exist_ok=True)
            fh = logging.FileHandler(log_path, encoding="utf-8")
            fh.setLevel(log_level)
            if is_prod:
                fh.setFormatter(CustomJSONFormatter())
            else:
                class ColorFreeFormatter(logging.Formatter):
                    def format(self, record):
                        timestamp = datetime.utcfromtimestamp(record.created).isoformat() + "Z"
                        level = record.levelname
                        message = record.getMessage()
                        exc = ""
                        if record.exc_info:
                            exc = f"\n{self.formatException(record.exc_info)}"
                        return f"[{timestamp}] {level}: {message}{exc}"
                fh.setFormatter(ColorFreeFormatter())
            logger.addHandler(fh)
        except Exception as e:
            print(f"Failed to setup file logging: {e}", file=sys.stderr)
            
    return logger

logger = get_logger()
