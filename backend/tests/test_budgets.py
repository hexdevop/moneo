import pytest

from app.api.routers.budgets import _progress_status
from app.models.enums import RecurrenceFrequency
from app.services.recurring import monthly_load


@pytest.mark.parametrize(
    "progress,expected",
    [
        (0.0, "green"),
        (0.5, "green"),
        (0.69, "green"),
        (0.7, "yellow"),
        (0.95, "yellow"),
        (1.0, "yellow"),
        (1.01, "red"),
        (2.0, "red"),
    ],
)
def test_progress_status_thresholds(progress, expected):
    assert _progress_status(progress) == expected


def test_monthly_load_monthly_is_unchanged():
    assert monthly_load(100, RecurrenceFrequency.monthly) == 100


def test_monthly_load_weekly_scales_up():
    assert monthly_load(100, RecurrenceFrequency.weekly) == pytest.approx(100 * 52 / 12)


def test_monthly_load_yearly_scales_down():
    assert monthly_load(1200, RecurrenceFrequency.yearly) == pytest.approx(100)
