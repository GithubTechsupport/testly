"""Main source package for the book processing system."""

__version__ = "1.0.0"

from . import core
from . import data
from . import models
from . import utils

__all__ = ["core", "data", "models", "utils"]