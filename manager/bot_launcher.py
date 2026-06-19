"""Launcher that runs a bot's entry file with its own directory on sys.path.

This environment uses an embeddable Python (python312._pth) which ignores
PYTHONPATH and does NOT add the script directory to sys.path automatically.
The bots do ``from config import ...`` / ``from zlapi import ...`` which rely on
the script directory being importable, so we insert the current working
directory (set to the bot dir by the manager) before running the entry file.
"""
import os
import runpy
import sys

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: bot_launcher.py <entry_file>", file=sys.stderr)
        sys.exit(2)
    entry = sys.argv[1]
    bot_dir = os.getcwd()
    sys.path.insert(0, bot_dir)
    # shift argv so the bot sees itself as the program
    sys.argv = [entry] + sys.argv[2:]
    runpy.run_path(entry, run_name="__main__")
