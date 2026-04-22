import asyncio
import websockets
import json
async def hello():
    async with websockets.connect('ws://localhost:8080/ws?username=robot') as websocket:
        msg = await websocket.recv()
        d = json.loads(msg)
        print('session type:', d.get('type'))
        msg2 = await websocket.recv()
        d2 = json.loads(msg2)
        if d2.get('type') == 'state':
            chunks = d2.get('chunks', [])
            if chunks:
                print('keys:', list(chunks[0].keys()))
                print('flowers:', len(chunks[0].get('flowers', [])))
                if chunks[0].get('flowers'):
                    print('flower 0:', chunks[0]['flowers'][0])
asyncio.run(hello())
