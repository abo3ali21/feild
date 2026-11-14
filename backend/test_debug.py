import asyncio
from app.models.schemas import FarmRequest
from app.services.environment import build_context
from app.core.engine import rank_rotations, suitability, load_crops

async def test():
    req = FarmRequest(
        latitude=25.7416,
        longitude=32.7712,
        current_crop_id='pearl_millet',
        soil_texture='SANDY_LOAM',
        is_irrigated=True,
        priority='balanced'
    )
    context, prov = await build_context(req)
    print('Context:')
    for k, v in context.model_dump().items():
        print(f'  {k}: {v}')
    
    crops = load_crops()
    print('\n=== Viability checks for each crop ===')
    viable = []
    for c in crops:
        checks = suitability(c, context, True)
        fails = [ch for ch in checks if not ch.passed]
        print(f'{c.crop_id}: viable={len(fails)==0}')
        for f in fails:
            print(f'   - {f.rule}: {f.reason}')
        if not fails:
            viable.append(c.crop_id)
    print('Viable crops:', viable)
    
    try:
        rots, rej = rank_rotations(context, 'pearl_millet', True, 'balanced')
        print(f'\nRotations found: {len(rots)}')
        for r in rots:
            print(' ', ' -> '.join(s.name for s in r.sequence))
    except Exception as e:
        print('Error in rank_rotations:', e)

asyncio.run(test())
