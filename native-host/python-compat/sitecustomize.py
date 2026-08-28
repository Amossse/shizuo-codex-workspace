"""拾作-only macOS compatibility hooks for HyperFrames Python workers."""

import errno
import os
import sys
from pathlib import Path


def _install_espeak_link_copy():
    if sys.platform != "darwin" or os.environ.get("PAGEDOCK_ESPEAK_LINK_COPY") != "1":
        return

    try:
        from phonemizer.backend.espeak import api as espeak_api
    except ImportError:
        return

    original_shutil = espeak_api.shutil

    class _ShutilProxy:
        def __getattr__(self, name):
            return getattr(original_shutil, name)

        @staticmethod
        def copy(source, destination, *args, **kwargs):
            source_path = Path(source)
            destination_path = Path(destination)
            if source_path.name.startswith("libespeak-ng") and destination_path.name.startswith("libespeak-ng"):
                try:
                    # Phonemizer normally creates a fresh dylib for every line. A hard link keeps
                    # the verified Mach-O inode while preserving its per-instance path semantics.
                    os.link(source_path, destination_path, follow_symlinks=False)
                    return str(destination_path)
                except OSError as error:
                    if error.errno != errno.EXDEV:
                        raise
                    os.symlink(source_path, destination_path)
                    return str(destination_path)
            return original_shutil.copy(source, destination, *args, **kwargs)

    espeak_api.shutil = _ShutilProxy()


_install_espeak_link_copy()
