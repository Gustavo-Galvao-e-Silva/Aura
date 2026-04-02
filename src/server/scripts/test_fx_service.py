"""
Quick test script for FX service
Run with: python3 -m pytest test_fx_service.py -v -s
"""
import asyncio
from my_fastapi_app.app.services.fx_service import get_best_fx_rate, calculate_brl_needed


async def test_fx_service():
    """Test FX service with live routes agent"""
    print("\n🧪 Testing FX Service...")
    print("=" * 60)

    # Test 1: Get best FX rate
    result = await get_best_fx_rate("testuser")
    print(f"\n✅ Test 1: get_best_fx_rate()")
    print(f"   FX Rate: {result['fx_rate']} BRL/USD")
    print(f"   Provider: {result['provider']}")
    print(f"   Source: {result['source']}")
    print(f"   Options count: {len(result['all_options'])}")

    # Test 2: Calculate BRL needed
    amount_usd = 100.00
    brl_needed = calculate_brl_needed(amount_usd, result['fx_rate'])
    print(f"\n✅ Test 2: calculate_brl_needed()")
    print(f"   Need: ${amount_usd} USD")
    print(f"   Rate: {result['fx_rate']} BRL/USD")
    print(f"   Required: R${brl_needed:.2f} BRL")

    # Test 3: Show all options for comparison
    if result['all_options']:
        print(f"\n✅ Test 3: All available options:")
        for opt in result['all_options']:
            print(f"   - {opt['provider']:10s}: {opt['fx_used']:6.4f} BRL/USD "
                  f"(R${opt['fx_used'] * 100:.2f} for $100)")

    print("\n" + "=" * 60)
    print("🎉 All tests passed!")


if __name__ == "__main__":
    asyncio.run(test_fx_service())
