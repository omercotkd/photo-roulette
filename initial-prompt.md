Hi, I want to create a photo-roulette game. It should work as follows:
1. A computer is hosting the game by running the backend and serving the frontend
2. Users access the frontend and create the game or join an existing one using a code
3. The game master can change the following settings: number of rounds, allowed videos (yes/no).
4. When a user enters the game, he selects 16 photos or selects an entire album and lets the game pick 16 - he can unselect a picture, and a new one will be allocated
5. When all users press ready, the game will start, a random picture from the bank will be shown, players will vote for who uploaded the picture, and a score will be given based on speed if the answer was correct.
6. After 10 seconds (this can also be configured by the host), the current leader board will be shown, and how many points each player gained, and their current streak.
7. After all rounds are done, players will see the leader board and a play again option.

Note: if we have 10 rounds and 4 players, each player will have at least 2 pictures/videos that he uploaded, shown- the formula:
The number of rounds floor divided by the number of players equals the minimum number of assets

The tech stack should be as follows:
react for the frontend using typescript
a node-based or Python-based backend
The pictures/videos players upload will be saved in a local folder and will be cleared after each game.

Ask any relevant questions that will help you later on this app, and I will not need to ask you to rewrite anything or fix bugs.