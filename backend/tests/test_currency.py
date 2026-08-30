import pytest

from app.services.currency import compute_cross_rate


def test_cross_rate_same_currency_via_hub():
    # HUB->USD is always 1.0, so from==to should yield 1.0 through the hub math too
    assert compute_cross_rate(hub_to_from=1.0, hub_to_to=1.0) == 1.0


def test_cross_rate_basic():
    # 1 USD = 12500 UZS, 1 USD = 0.92 EUR -> 1 UZS = 0.92/12500 EUR
    rate = compute_cross_rate(hub_to_from=12500, hub_to_to=0.92)
    assert rate == pytest.approx(0.92 / 12500)


def test_cross_rate_is_inverse_symmetric():
    hub_to_from, hub_to_to = 4.0, 90.0
    forward = compute_cross_rate(hub_to_from, hub_to_to)
    backward = compute_cross_rate(hub_to_to, hub_to_from)
    assert forward * backward == pytest.approx(1.0)
