"""The objects `create_panel_app` puts on the application, handed to endpoints as dependencies."""

from fastapi import Request

from app.panel.clock import Clock
from app.panel.services.secret_box import SecretBox
from app.panel.services.sessions import SessionTimes
from app.panel.services.snapshots import PublicFiles


def get_clock(request: Request) -> Clock:
    clock: Clock = request.app.state.clock
    return clock


def get_box(request: Request) -> SecretBox:
    box: SecretBox = request.app.state.box
    return box


def get_session_times(request: Request) -> SessionTimes:
    times: SessionTimes = request.app.state.session_times
    return times


def get_public_files(request: Request) -> PublicFiles:
    files: PublicFiles = request.app.state.public_files
    return files
