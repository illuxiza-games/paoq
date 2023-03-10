import black from '@/assets/black.png';
import white from '@/assets/white.png';
import {Footer, Game, Header, Nav} from '@/components'
import {boardSize, getIndexByBoard} from "@/config/board";
import modes from '@/config/modes'
import {useGo, usePieces, useRemoteGo, useStore} from "@/hooks";
import {
    blackJson,
    changeSelfColor,
    handlePieceMove,
    handleRestart,
    PieceMoveData,
    updateBoard,
    updateRule,
    updateSelectPiece,
    whiteJson
} from "@/stores/game";
import {GameUtils} from "@/utils";

import {addRoom, configClient, leaveRoom, resetRoom} from "@illuxiza/one-client";
import {redo, undo, useOnline} from "@illuxiza/one-client-react";
import React, {useState} from 'react';
import {useParams} from "react-router-dom";
import {useMount, useUpdateEffect} from "react-use";

import './index.scss'

import StepRecord from "./record";
import RuleSetting from "./setting";


const Play = () => {
    const gameInfo = useStore(state => state.game);
    const [pause, setPause] = useState(false);
    const pieces = usePieces(gameInfo.board, gameInfo.selfIsWhite);
    const online = useOnline();
    const go = useGo();
    const params = useParams();
    const mode = params.mode as (keyof typeof modes) || 'ai';
    const remoteGo = useRemoteGo(mode);
    const cfg = modes[mode];
    const [open, setOpen] = useState(false);
    const [showRule, setShowRule] = useState(false);


    const sameColor = gameInfo.selfIsWhite === gameInfo.stepIsWhite;


    useMount(() => {
        go(handleRestart())
        if (mode === 'local' && gameInfo.selfIsWhite) {
            go(changeSelfColor())
        }
        if (mode === 'remote') {
            configClient("ws://game.congeer.com/game/ws", {
                maxPlayer: 2,
                baseConfig: [JSON.stringify(updateRule(gameInfo.rule)), JSON.stringify(updateBoard(gameInfo.boardKey))],
                playerConfig: [[blackJson], [whiteJson]],
                onConfig: go,
                onFrame: go,
                onReset: go
            }, "tko")
            const roomParam = params.roomId!;
            addRoom(roomParam)
        }
    })

    useUpdateEffect(() => {
        if (!pause && mode === 'ai' && !sameColor && !gameInfo.gameIsEnd) {
            // ??????????????????????????????????????????
            setTimeout(() => {
                const nextStep = GameUtils.aiNextStep(
                    [...gameInfo.board],
                    gameInfo.stepIsWhite,
                    !gameInfo.selfIsWhite,
                    gameInfo.rule
                );
                if (nextStep) {
                    go(handlePieceMove(nextStep));
                }
            }, 500);
        }
    })

    const canUsePiece = (num: number) => {
        if (gameInfo.gameIsEnd) {
            return false;
        }
        if (pause) {
            return false;
        }
        const stepPiece = (num > 0) === gameInfo.stepIsWhite;
        if (mode !== 'local') {
            return stepPiece && sameColor
        }
        return stepPiece;
    }

    const onPieceMove = (data: PieceMoveData) => {
        let rowIndex = getIndexByBoard(data.y);
        let colIndex = getIndexByBoard(data.x);
        if (gameInfo.selfIsWhite) {
            rowIndex = 3 - rowIndex;
            colIndex = 3 - colIndex;
        }
        remoteGo(handlePieceMove({num: data.num, rowIndex, colIndex}))
    };

    const opStep = mode === 'local' || !sameColor || pause ? 1 : 2;

    const onBack = () => {
        if (mode === 'remote') {
            leaveRoom()
        }
    };

    const onPieceSelect = (num: number) => {
        if (!canUsePiece(num)) {
            return;
        }
        go(updateSelectPiece(num))
    }
    let endBecause = '';
    const absOneStep = Math.abs(gameInfo.onlyOnePieceStep);
    if (gameInfo.gameIsEnd) {
        if (absOneStep === 11) {
            endBecause = `${gameInfo.onlyOnePieceStep > 0 ? '???' : '???'}???????????????????????????10????????????`;
        } else {
            endBecause = `${gameInfo.stepIsWhite ? '???' : '???'}????????????${gameInfo.stepIsWhite ? '???' : '???'}?????????????????????`;
        }
    } else if (gameInfo.onlyOnePieceStep !== 0) {
        endBecause = `${gameInfo.onlyOnePieceStep > 0 ? '???' : '???'}???????????????????????????${11 - absOneStep}????????????`
    }


    const resetGame = () => {
        if (mode === "remote" && !online.isPlayer) {
            return;
        }
        remoteGo(handleRestart());
        if (mode === "remote") {
            resetRoom()
        }
    }
    const undoGame = () => {
        if (mode === "remote" && !online.isPlayer) {
            return;
        }
        remoteGo(undo(opStep));
    }
    const redoGame = () => {
        if (mode === "remote" && !online.isPlayer) {
            return;
        }
        remoteGo(redo(opStep));
    }
    return (
        <div className="main" style={{width: `${boardSize.board}px`}}>
            <Nav title={cfg.title} onSetting={() => setShowRule(true)} onBack={onBack}/>
            <Header mode={mode} selfIsWhite={gameInfo.selfIsWhite} otherSideOnline={online.playerCount === 2}
                    channelId={params.roomId ? params.roomId!.substring(0, 4) : ''} isViewer={!online.isPlayer}
                    selfId={online.playerId} players={online.players}/>
            <div className="board">
                <div className="board-header">
                    <div className="header-button">
                        <button style={{marginRight: '10px'}} onClick={resetGame}>??????
                        </button>
                        <button style={{marginRight: '10px'}} onClick={() => setPause(!pause)}>{pause ? '??????' : '??????'}
                        </button>
                    </div>
                    {!gameInfo.gameIsEnd ?
                        <div className="color-piece">
                            <img alt="" className="piece-img"
                                 src={gameInfo.stepIsWhite ? white : black}
                            />
                            <span>??????{mode === 'local' ? gameInfo.stepIsWhite ? '???' : '???' :
                                sameColor ? '???' : '???'}?????????</span>
                        </div> : <></>}
                </div>
                <div className="board-body"
                     style={{height: `${boardSize.board}px`}}>
                    <Game
                        stepIsSelf={gameInfo.selfIsWhite === gameInfo.stepIsWhite}
                        selectPiece={gameInfo.selectPiece}
                        boardSize={boardSize}
                        pieceDraggable={canUsePiece}
                        pieces={pieces}
                        onPieceMove={onPieceMove}
                        onPieceSelect={onPieceSelect}
                    />
                </div>
            </div>
            <Footer mode={mode} selfIsWhite={gameInfo.selfIsWhite} isViewer={!online.isPlayer}
                    displayName={online.playerId}>
                {gameInfo.steps === 0 ?
                    <button onClick={() => remoteGo(changeSelfColor())}>
                        ??????
                    </button> :
                    <>
                        <button onClick={undoGame} disabled={gameInfo.gameIsEnd}>??????
                        </button>
                        <button onClick={redoGame} disabled={gameInfo.gameIsEnd}>??????
                        </button>
                        <button onClick={() => setOpen(true)}>
                            ??????
                        </button>
                    </>
                }
            </Footer>
            <div className="board-footer">
                <div>{endBecause}</div>
            </div>
            <StepRecord open={open} mode={mode} onClose={() => setOpen(false)}/>
            <RuleSetting open={showRule} onClose={() => setShowRule(false)}/>
        </div>
    );
}

export default Play;
