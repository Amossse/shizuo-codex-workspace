#!/usr/bin/env python3
"""Small JSON-lines bridge between 拾作's Native Host and a real POSIX PTY."""

import argparse
import base64
import errno
import fcntl
import json
import os
import pty
import selectors
import signal
import struct
import sys
import termios
import time


# Keep terminal output responsive while preventing tiny PTY reads from turning into
# tens of thousands of Native Messaging events per second.
OUTPUT_BATCH_BYTES = 32 * 1024
OUTPUT_BATCH_DELAY_SECONDS = 0.016


def emit(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def resize(master_fd, cols, rows):
    cols = max(2, min(1000, int(cols or 80)))
    rows = max(2, min(1000, int(rows or 24)))
    fcntl.ioctl(master_fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))


def terminate_child(pid):
    try:
        os.killpg(pid, signal.SIGHUP)
    except ProcessLookupError:
        return
    except OSError:
        try:
            os.kill(pid, signal.SIGHUP)
        except OSError:
            pass


def read_available(master_fd):
    chunks = []
    total = 0
    while total < OUTPUT_BATCH_BYTES:
        try:
            chunk = os.read(master_fd, OUTPUT_BATCH_BYTES - total)
        except BlockingIOError:
            break
        except OSError as error:
            if error.errno in (errno.EAGAIN, errno.EWOULDBLOCK, errno.EIO):
                break
            raise
        if not chunk:
            break
        chunks.append(chunk)
        total += len(chunk)
    return b"".join(chunks)


def main():
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--shell", required=True)
    parser.add_argument("--cwd", required=True)
    parser.add_argument("--cols", type=int, default=100)
    parser.add_argument("--rows", type=int, default=30)
    args = parser.parse_args()

    pid, master_fd = pty.fork()
    if pid == 0:
        os.chdir(args.cwd)
        environment = dict(os.environ)
        environment.update({"TERM": "xterm-256color", "COLORTERM": "truecolor", "PAGEDOCK_TERMINAL": "1"})
        shell_name = os.path.basename(args.shell)
        os.execvpe(args.shell, [f"-{shell_name}"], environment)

    resize(master_fd, args.cols, args.rows)
    current_flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, current_flags | os.O_NONBLOCK)
    selector = selectors.DefaultSelector()
    selector.register(master_fd, selectors.EVENT_READ, "pty")
    selector.register(sys.stdin.buffer, selectors.EVENT_READ, "control")
    control_buffer = b""
    pty_read_at = None
    pty_registered = True
    emit({"type": "ready", "pid": pid, "cwd": args.cwd, "cols": args.cols, "rows": args.rows})

    try:
        while True:
            now = time.monotonic()
            if pty_read_at is not None and now >= pty_read_at:
                chunk = read_available(master_fd)
                if chunk:
                    emit({"type": "output", "data": base64.b64encode(chunk).decode("ascii")})
                pty_read_at = None
                if not pty_registered:
                    selector.register(master_fd, selectors.EVENT_READ, "pty")
                    pty_registered = True

            child_pid, status = os.waitpid(pid, os.WNOHANG)
            if child_pid == pid:
                # A final read preserves output produced immediately before shell exit.
                chunk = read_available(master_fd)
                if chunk:
                    emit({"type": "output", "data": base64.b64encode(chunk).decode("ascii")})
                code = os.waitstatus_to_exitcode(status)
                emit({"type": "exit", "exitCode": code})
                return code

            timeout = 0.25 if pty_read_at is None else max(0, pty_read_at - time.monotonic())
            for key, _mask in selector.select(timeout=timeout):
                if key.data == "pty":
                    # Stop watching the constantly-readable PTY until the batch window
                    # expires. The kernel buffer then provides natural backpressure.
                    selector.unregister(master_fd)
                    pty_registered = False
                    pty_read_at = time.monotonic() + OUTPUT_BATCH_DELAY_SECONDS
                    continue

                chunk = os.read(sys.stdin.fileno(), 65536)
                if not chunk:
                    terminate_child(pid)
                    return 0
                control_buffer += chunk
                while b"\n" in control_buffer:
                    line, control_buffer = control_buffer.split(b"\n", 1)
                    if not line.strip():
                        continue
                    message = json.loads(line.decode("utf-8"))
                    message_type = message.get("type")
                    if message_type == "input":
                        os.write(master_fd, base64.b64decode(message.get("data") or ""))
                    elif message_type == "resize":
                        resize(master_fd, message.get("cols"), message.get("rows"))
                        os.kill(pid, signal.SIGWINCH)
                    elif message_type == "close":
                        terminate_child(pid)
                        return 0
    finally:
        selector.close()
        try:
            os.close(master_fd)
        except OSError:
            pass


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        emit({"type": "error", "error": str(error)})
        raise
