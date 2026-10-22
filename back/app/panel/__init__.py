"""The admin panel's API: a separate application with its own database account (SEC-B-07).

It runs in its own container, behind its own nginx, and nothing in `app/main.py` (the public API) imports it.
"""
