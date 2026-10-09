import asyncio

from scheduler import EXTRACT_PRIORITY, TTS_PRIORITY, HeavyWorkSlot


def test_runs_one_job_at_a_time_and_prefers_extract() -> None:
    async def scenario() -> list[str]:
        slot = HeavyWorkSlot()
        order: list[str] = []
        running = 0
        max_running = 0

        async def job(name: str, priority: int, delay: float) -> None:
            nonlocal running, max_running
            await asyncio.sleep(delay)
            async with slot.acquire(priority):
                running += 1
                max_running = max(max_running, running)
                order.append(name)
                await asyncio.sleep(0.01)
                running -= 1

        await asyncio.gather(
            job("tts-1", TTS_PRIORITY, 0),
            job("tts-2", TTS_PRIORITY, 0.001),
            job("extract", EXTRACT_PRIORITY, 0.002),
        )
        assert max_running == 1
        return order

    # tts-1 yuvayı aldı; sonradan gelen extract, bekleyen tts-2'nin önüne geçer.
    assert asyncio.run(scenario()) == ["tts-1", "extract", "tts-2"]
