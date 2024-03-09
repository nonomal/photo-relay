/**
 * https://chakra-ui.com/docs/components
 */
import { getImageRect } from '@/common/file';
import { useCanvasEvent } from '@/hooks/useCanvasEvent';
import { Box } from '@chakra-ui/react';
import { pick } from 'lodash';
import Scrollbars from 'rc-scrollbars';
import { useEffect, useRef, useState } from 'react';
import Draggable from 'react-draggable';
import { getDPR } from '../../common/client';
import { useHotKey } from '../../hooks/useWindows';
import useArtboardStore from '../../store/artboard';
import CenterControl from './CenterControl';
import api from './apiServices';
import './index.scss';
import LeftControl from './leftPanel';
import fabric from './preset';
import RightControl from './rightPanel';
import MouseMenu from './MouseMenu';
import AdSense from './components/AdSense';

const { addImageFromURL, setCanvas, updateCanvasRect } = api;
const dpr = getDPR();

export default function Artboard() {
  const { width, height, presetBackGround, changeRect, dragDisabled, update } = useArtboardStore();
  const $usePresetBackground = useRef<boolean>(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState<boolean>(false);

  useCanvasEvent(ready);

  // set canvas width height
  useEffect(() => {
    const canvas: any = new fabric.Canvas('artboard', {
      fireRightClick: false,
      controlsAboveOverlay: true,
      stopContextMenu: false,
      selectionBorderColor: 'ff0000',
      selectionLineWidth: 2,
    });

    setCanvas(canvas);
    updateCanvasRect(width, height);
    setReady(true);
  }, []);

  // use preset gallery image as background image
  useEffect(() => {
    if ($usePresetBackground.current || !ready || !presetBackGround) {
      return;
    }
    $usePresetBackground.current = true;
    const setBackGroundImage = () => {
      addImageFromURL({
        url: presetBackGround,
        selectable: false,
        position: {},
        scale: 1,
      });
    };
    getImageRect(presetBackGround).then((rs: any) => {
      const { width, height } = rs;
      changeRect({
        width: width * dpr,
        height: height * dpr,
      });
      setBackGroundImage();
    });
  }, [presetBackGround, ready]);

  useEffect(() => {
    // resize artboard
    if (ready) {
      updateCanvasRect(width, height);
    }

    // update artboard position
    if (width && height) {
      setPosition({
        x: (window.innerWidth - width / dpr) / 2,
        y: (window.innerHeight - height / dpr) / 2,
      });
    }
  }, [width, height, ready]);

  useHotKey({
    keyDownCallback: (keyCode) => {
      // when press space, you can drag artboard to any postion
      if (keyCode === 32) {
        update({ dragDisabled: false });
      }
    },
    keyUpCallback: () => {
      // when keyup, you can not drag any more
      update({ dragDisabled: true });
    },
  });

  const handleDrag = (e: any, ui: any) => setPosition(pick(ui, ['x', 'y']));

  return (
    <div className="artboard">
      <LeftControl />
      <Scrollbars>
        <Box w={'500vw'} h={'500vh'}>
          <Draggable position={position} onDrag={handleDrag} disabled={dragDisabled}>
            <Box position={'relative'}>
              <canvas id="artboard" />
              {dragDisabled ? null : <Box top={0} position={'absolute'} w={width / dpr} h={height / dpr}></Box>}
            </Box>
          </Draggable>
        </Box>
      </Scrollbars>
      <RightControl />
      <CenterControl />
      <MouseMenu />
      <AdSense />
    </div>
  );
}
