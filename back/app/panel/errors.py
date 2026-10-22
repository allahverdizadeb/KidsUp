"""What can go wrong in the admin panel, as exceptions the services raise (never `HTTPException`).

`app/panel/main.py` maps each of them to a status code and a stable body in one place. The text
is safe to show: it names no person, no record's content and no internals (SEC-B-12).
"""


class PanelError(Exception):
    """Base of the panel's own errors. `extra` adds numbers or a key to the body, never personal data."""

    def __init__(self, **extra: int | str) -> None:
        super().__init__()
        self.extra = extra


class InvalidCredentialsError(PanelError):
    """Unknown account, wrong password, wrong or reused code, locked or switched-off account: one message."""


class WrongPasswordError(PanelError):
    """The current password given to change it is not the current password."""


class WeakPasswordError(PanelError):
    """The new password does not meet the rules (length, obvious choices)."""


class BusyError(PanelError):
    """Too many password checks run at once: nothing was checked, so nothing counts as a failed attempt."""


class ApplicationNotFoundError(PanelError):
    pass


class NoteNotFoundError(PanelError):
    pass


class CourseNotFoundError(PanelError):
    pass


class NotEnoughSeatsError(PanelError):
    """Approving would take more places than the course has free."""


class ApprovalLockedError(PanelError):
    """Taking an approval back is for whoever may also erase: the family's data is then up for deletion."""


class TooManyNotesError(PanelError):
    """An application already has as many notes as it may."""


class CapacityBelowApprovedError(PanelError):
    """A course cannot get fewer places than the children already approved for it."""


class InvalidCourseError(PanelError):
    """The course as it would be makes no sense (the youngest age above the oldest)."""


class CourseHasApplicationsError(PanelError):
    """A course with applications is closed, not deleted: the applications belong to it."""


class ConfirmationRequiredError(PanelError):
    """A deletion is asked for without the explicit confirmation."""


class UnknownContentKeyError(PanelError):
    pass


class InvalidContentError(PanelError):
    """A value does not fit the field it is meant for (too long, wrong kind, a link that is not allowed)."""


class InvalidImageError(PanelError):
    """The upload is not an image the site accepts (type, size, dimensions)."""


class MediaNotFoundError(PanelError):
    pass


class MediaInUseError(PanelError):
    """The draft or the live page still shows the picture."""


class PublicFileError(PanelError):
    """A file for the landing page could not be written, so nothing was published or stored."""


class TooManyRowsError(PanelError):
    """An export would hold more rows than one download may."""
