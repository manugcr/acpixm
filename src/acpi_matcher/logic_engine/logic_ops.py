from typing import Callable


class LogicOps:
    """
    Stateless operations. Keep each op tiny and predictable.
    """

    @staticmethod
    def add(*numbers: int) -> int:
        return sum(numbers)

    @staticmethod
    def sub(*numbers: int) -> int:
        if not numbers:
            return 0
        total = numbers[0]
        for n in numbers[1:]:
            total -= n
        return total

    @staticmethod
    def gt(a: int, b: int) -> bool:
        return a > b

    @staticmethod
    def in_range(value: int, bounds: list[int]) -> bool:
        low, high = bounds
        if low > high:
            low, high = high, low
        return low <= value <= high

    @staticmethod
    def in_any_range(value: int, ranges: list[tuple]) -> bool:
        for start, end in ranges:
            if start <= value <= end:
                return True
        return False

    @staticmethod
    def registry() -> dict[str, Callable]:
        return {
            "add": LogicOps.add,
            "sub": LogicOps.sub,
            "gt": LogicOps.gt,
            "in-range": LogicOps.in_range,
            "in-any-range": LogicOps.in_any_range,
        }
