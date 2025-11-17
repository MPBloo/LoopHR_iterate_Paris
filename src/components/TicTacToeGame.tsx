import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface TicTacToeGameProps {
  isOpen: boolean;
  onClose: () => void;
  role: 'interviewer' | 'candidate' | 'interviewee';
  onGameStateChange?: (gameState: GameState) => void;
  externalGameState?: GameState;
}

export interface GameState {
  board: (string | null)[];
  currentPlayer: 'X' | 'O';
  winner: string | null;
  isDraw: boolean;
}

const TicTacToeGame = ({ isOpen, onClose, role, onGameStateChange, externalGameState }: TicTacToeGameProps) => {
  const [gameState, setGameState] = useState<GameState>({
    board: Array(9).fill(null),
    currentPlayer: 'X',
    winner: null,
    isDraw: false,
  });

  // Sync with external game state if provided
  useEffect(() => {
    if (externalGameState) {
      setGameState(externalGameState);
    }
  }, [externalGameState]);

  const checkWinner = (board: (string | null)[]) => {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];

    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    return null;
  };

  const handleClick = (index: number) => {
    if (gameState.board[index] || gameState.winner || gameState.isDraw) return;

    const newBoard = [...gameState.board];
    newBoard[index] = gameState.currentPlayer;

    const winner = checkWinner(newBoard);
    const isDraw = !winner && newBoard.every(cell => cell !== null);

    const newGameState: GameState = {
      board: newBoard,
      currentPlayer: gameState.currentPlayer === 'X' ? 'O' : 'X',
      winner,
      isDraw,
    };

    setGameState(newGameState);
    onGameStateChange?.(newGameState);
  };

  const resetGame = () => {
    const newGameState: GameState = {
      board: Array(9).fill(null),
      currentPlayer: 'X',
      winner: null,
      isDraw: false,
    };
    setGameState(newGameState);
    onGameStateChange?.(newGameState);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={role === 'interviewer' ? onClose : undefined} />
      
      {/* Liquid Glass Popup with animations */}
      <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 max-w-md w-full mx-4 animate-in fade-in zoom-in duration-300">
        {/* Decorative circle behind - adds depth */}
        <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-full blur-3xl" />
        
        {/* Close Button - Only for Interviewer */}
        {role === 'interviewer' && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/30 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] group"
          >
            <X className="w-5 h-5 text-white transition-transform duration-300 group-hover:rotate-90" />
          </button>
        )}

        {/* Title with mixed fonts (Gothic + Sans Serif style) */}
        <div className="text-center mb-6 animate-in slide-in-from-top duration-500">
          <h2 className="text-3xl font-bold text-white drop-shadow-lg tracking-tight">
            <span className="font-serif">Tic</span>
            <span className="text-blue-300 mx-1">·</span>
            <span className="font-serif">Tac</span>
            <span className="text-pink-300 mx-1">·</span>
            <span className="font-serif">Toe</span>
          </h2>
          <p className="text-xs text-white/60 mt-1 uppercase tracking-widest">(Mini Game)</p>
        </div>

        {/* Game Status */}
        <div className="text-center mb-6 animate-in slide-in-from-top duration-700 delay-100">
          {gameState.winner ? (
            <div className="animate-in zoom-in duration-300">
              <p className="text-xl font-semibold text-white drop-shadow-lg">
                🎉 <span className={gameState.winner === 'X' ? 'text-blue-300' : 'text-pink-300'}>Player {gameState.winner}</span> wins!
              </p>
            </div>
          ) : gameState.isDraw ? (
            <p className="text-xl font-semibold text-white drop-shadow-lg animate-in zoom-in duration-300">
              🤝 It's a draw!
            </p>
          ) : (
            <p className="text-lg text-white/90 drop-shadow-lg">
              Current: <span className={`font-bold ${gameState.currentPlayer === 'X' ? 'text-blue-300' : 'text-pink-300'}`}>{gameState.currentPlayer}</span>
            </p>
          )}
        </div>

        {/* Game Board with staggered animations */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {gameState.board.map((cell, index) => (
            <button
              key={index}
              onClick={() => handleClick(index)}
              disabled={!!cell || !!gameState.winner || gameState.isDraw}
              style={{
                animationDelay: `${800 + index * 50}ms`
              }}
              className="aspect-square bg-white/5 backdrop-blur-md hover:bg-white/15 border border-white/20 rounded-2xl flex items-center justify-center text-4xl font-bold text-white transition-all duration-300 disabled:cursor-not-allowed hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] disabled:hover:shadow-none disabled:hover:bg-white/5 disabled:hover:scale-100 animate-in fade-in zoom-in"
            >
              {cell && (
                <span className={`${cell === 'X' ? 'text-blue-300' : 'text-pink-300'} drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] animate-in zoom-in duration-200`}>
                  {cell}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Reset Button */}
        {(gameState.winner || gameState.isDraw) && (
          <button
            onClick={resetGame}
            className="w-full py-3 bg-gradient-to-r from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 border border-white/30 rounded-xl text-white font-semibold transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(147,51,234,0.4)] animate-in slide-in-from-bottom duration-500"
          >
            Play Again
          </button>
        )}
      </div>
    </div>
  );
};

export default TicTacToeGame;
