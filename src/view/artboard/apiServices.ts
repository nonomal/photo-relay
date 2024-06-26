import { rx } from '@/common/rx';
import { getDPR } from '../../common/client.js';
import { fetchText } from '../../common/file.js';
import { isImage, isObject } from '../../common/is.js';
import { getRandString, removeUndefined } from '../../common/math.js';
import { imagePrefix } from './Constant.js';
import config from './config.js';
import fabric from './preset.js';
import _, { get } from 'lodash';
import { localFont } from '../../common/font.js';

const dpr = getDPR();

class ApiService {
  canvas: any = undefined;

  static instance: any;

  static getInstance = (): ApiService => {
    if (!(ApiService as any).instance) {
      this.instance = new ApiService();
    }
    return this.instance;
  };

  setCanvas = (canvas: any) => {
    this.canvas = canvas;
  };

  updateCanvasRect = (width: number, height: number) => {
    const { canvas } = this;
    canvas.setWidth(parseInt(`${width / dpr}`, 10));
    canvas.setHeight(parseInt(`${height / dpr}`, 10));
  };

  addImage = ({
    imageTag,
    width,
    height,
    selectable = false,
    autocenter = true,
    position = {},
    scale = 1,
    autoFocus = true,
    removeCurrentSelected = true,
    borderRadius = 30,
  }: NSArtboard.addImageParams) => {
    const { canvas, getSelected } = this;
    const image = imageTag;
    image.setAttribute('crossOrigin', 'Anonymous');

    const rect = {
      width,
      height,
      top: 0,
      left: 0,
    };

    if (autocenter && selectable && !isObject(position)) {
      let w = width;
      let h = height;

      if (scale !== 0) {
        w *= scale;
        h *= scale;
      }
      rect.left = (canvas.width - w) / 2;
      rect.top = (canvas.height - h) / 2;
    }
    if (isObject(position) && _.isNumber(position.left) && _.isNumber(position.top)) {
      rect.left = position.left;
      rect.top = position.top;
    }

    if (removeCurrentSelected) {
      const selected = getSelected();

      // eslint-disable-next-line no-underscore-dangle
      if (selected && !selected._objects) {
        canvas.remove(selected);
        rect.left = selected.left;
        rect.top = selected.top;
      }
    }

    fabric.Image.fromURL(
      image.src,
      (img: any) => {
        img.set({
          ...{ selectable, cornerRadius: 30, transparentCorners: true },
          ...rect,
        });

        if (selectable) {
          if (scale !== 1) {
            img.scaleToHeight(height * scale);
            img.scaleToWidth(width * scale);
          }

          canvas.add(img);
          if (autoFocus) {
            canvas.setActiveObject(img);
          }
        } else {
          // disable to select background
          if (!selectable) {
            img.scaleToHeight(canvas.height);
            img.scaleToWidth(canvas.width);
          }
          canvas.backgroundImage = img;
        }
        canvas.renderAll();
      },
      { crossOrigin: 'Anonymous', id: getRandString() } as any,
    );
  };

  removeBackgroundImage = () => {
    const { canvas } = this;
    canvas.backgroundImage = undefined;
    canvas.backgroundColor = undefined;
    canvas.renderAll();
  };

  setBackgroundColor = ({ color }: { color: string }) => {
    const { canvas } = this;
    canvas.backgroundColor = color;
    canvas.renderAll();
  };

  setBackgroundColorGradient = ({ startColor, endColor }: { startColor: string; endColor: string }) => {
    const { canvas } = this;
    const gradient = new fabric.Gradient({
      type: 'linear',
      offsetX: 0,
      offsetY: 0,
      coords: { x1: 0, y1: canvas.height, x2: canvas.width, y2: canvas.height },
      colorStops: [
        { color: startColor, offset: 0 },
        { color: endColor, offset: 1 },
      ],
    });

    canvas.setBackgroundColor(gradient);
    canvas.renderAll();
  };

  getCanvasRect = () => {
    const { canvas } = this;
    const el = canvas.lowerCanvasEl;
    const { width, height } = el;

    return { width: Math.floor(width / dpr), height: Math.floor(height / dpr) };
  };

  addImageFromURL = ({
    url,
    selectable = true,
    scale = 1,
    position = {},
    autoFocus,
  }: NSArtboard.addImageFromURLParams) => {
    const { getSelected, getSelectedType, getCanvasRect, addImage } = this;
    const image = new Image();
    let zoom = scale;
    const selected = getSelected();

    if (selected) {
      const type = getSelectedType(selected);

      if (type === 'i-text') {
        return Promise.reject(new Error('Text cannot be replaced with an image'));
      }
    }

    return new Promise((resolve, reject) => {
      image.setAttribute('crossOrigin', 'Anonymous');
      image.onload = () => {
        image.onload = () => {};
        const { width, height } = image;
        const artboardRect = getCanvasRect();

        if (scale === 1) {
          if (width > artboardRect.width * 0.6 || height > artboardRect.height * 0.6) {
            zoom = Math.min((artboardRect.width / width) * 0.6, (artboardRect.height / height) * 0.6);
          }

          if (selected && selected.scaleX) {
            zoom = selected.scaleX;
          }
        }

        addImage({
          imageTag: image,
          width,
          height,
          selectable,
          scale: zoom,
          position,
          autoFocus,
        });

        Promise.resolve(() => resolve(true));
      };
      image.onerror = () => {
        image.onerror = () => {};
        reject(new Error('Failed to obtain sticker resources'));
      };

      image.src = url;
    });
  };

  getSelected = () => {
    const { canvas } = this;
    if (!canvas) {
      return null;
    }

    return canvas.getActiveObject();
  };

  getSelectedType = (selected?: any): NSArtboard.SelectedType => {
    const select = selected || this.getSelected();
    if (!select) {
      return '';
    }

    return select.type;
  };

  unSelectAll = () => {
    const { canvas } = this;
    if (canvas && canvas.discardActiveObject) {
      canvas.discardActiveObject();
      canvas.renderAll();
    }
  };

  clear = () => {
    this.canvas.clear();
  };

  changeCanvasBackgroundImage = (image: HTMLImageElement) => {
    const { canvas } = this;
    image.setAttribute('crossOrigin', 'Anonymous');

    fabric.Image.fromURL(
      image.src,
      (img) => {
        img.scaleToHeight(canvas.height);
        img.scaleToWidth(canvas.width);
        canvas.backgroundImage = img;
        canvas.renderAll();
      },
      { crossOrigin: 'Anonymous' },
    );
  };

  insertText = ({
    text = 'DuelPeak',
    defaultStyle = config.textStyle,
    autocenter = true,
    scale,
  }: NSArtboard.insertTextParams) => {
    const { canvas, changeStyle } = this;
    const rect = {
      width: 150,
    };

    const textParams = Object.assign(
      {
        id: getRandString(),
        left: 0,
        top: 10,
        fontSize: 60,
        fontWeight: 400,
        fill: '#333',
        charSpacing: 0,
        paintFirst: 'stroke',
        fontFamily: get(localFont, 'list', []).filter((font) => font.length < 15)[0] || '',
      },
      rect,
      removeUndefined(defaultStyle),
    );

    const textbox: any = new fabric.IText(text, textParams as any);

    if (scale) {
      textbox.set('scaleX', scale);
      textbox.set('scaleY', scale);
    }

    if (autocenter) {
      const { width, height } = canvas;

      const left = parseInt(`${(width - textbox.width) / 2}`, 10);
      const top = parseInt(`${(height - textbox.height) / 2}`, 10);

      textbox.set({ left, top });
    }

    textbox.bringToFront();
    canvas.add(textbox);
    canvas.renderAll();
    canvas.setActiveObject(textbox);
    changeStyle({ fill: defaultStyle.fill || '#333' });
  };

  insertRect = (styles: NSArtboard.TextStyles) => {
    const rect = new fabric.Rect({
      left: 100,
      top: 100,
      width: 400,
      height: 300,
      objectCaching: false,
      stroke: 'pink',
      strokeWidth: 3,
      ...styles,
    });

    rect.set('id' as any, getRandString());

    this.canvas.add(rect);
    this.canvas.setActiveObject(rect);
  };

  translateFontCss2Attribute = (styles: NSArtboard.TextStyles) => {
    const cssMap: Record<string, string> = {
      borderWidth: 'strokeWidth',
      borderColor: 'stroke',
      shadowColor: 'shadowColor',
    };
    const newStyle: Record<string, any> = {};

    Object.keys(styles).forEach((key) => {
      const newKey = cssMap[key];

      if (key === 'shadowColor') {
        newStyle.shadow = new fabric.Shadow({
          color: styles.shadowColor,
          offsetX: 3,
          offsetY: 3,
          blur: 0,
        });
      } else if (newKey) {
        newStyle[newKey] = (styles as any)[key];
      } else {
        newStyle[key] = (styles as any)[key];
      }
    });

    return newStyle;
  };

  changeStyle = (styles: NSArtboard.TextStyles = {}) => {
    const { canvas, getSelected, translateFontCss2Attribute } = this;
    const selected = getSelected();

    if (selected && selected.set) {
      const styleAttr = translateFontCss2Attribute(styles);

      if (!styleAttr.shadow) {
        styleAttr.shadow = {};
      }

      selected.set(styleAttr);
      canvas.renderAll();
      rx.next({
        type: 'object:modified',
        data: selected,
      });
    } else {
      return new Error('Please Select Text first!');
    }

    return true;
  };

  setLayout = (dir: NSArtboard.Dir) => {
    const { canvas, getSelected } = this;
    const el = getSelected();

    if (el) {
      switch (dir) {
        case 'top':
          el.set('top', 0);
          break;
        case 'right':
          el.set('left', canvas.width - el.width * el.scaleX);
          break;
        case 'bottom':
          el.set('top', canvas.height - el.height * el.scaleY);
          break;
        case 'left':
          el.set('left', 0);
          break;
        case 'center':
          el.center();
          break;
        case 'x-center':
          const y = el.get('top');
          el.center();
          el.set('top', y);
          break;
        case 'y-center':
          const x = el.get('left');
          el.center();
          el.set('left', x);
          break;
      }
      canvas.renderAll();
    }
  };

  changeShapeFillColor = (color: string) => {
    const { canvas, getSelected } = this;
    if (!color) {
      return;
    }
    const shape = getSelected();
    const img = shape.getElement();

    if (!isImage(img)) {
      return;
    }

    if (img.src.startsWith('http:') || img.src.startsWith('https:')) {
      if (img.src.includes('.svg')) {
        fetchText(img.src).then((text: any) => {
          if (!text) {
            return;
          }
          if (!text.includes('fill=')) {
            text = text.replace('<path ', '<path fill="#333" ');
          }
          const newText = text.replace(/#[\w]{3,6}/g, color);

          img.src = `${imagePrefix},${encodeURIComponent(newText)}`;
          img.onload = () => {
            img.onload = () => {};
            canvas.renderAll();
          };
        });
      }
    } else if (img.src.startsWith(imagePrefix)) {
      const { src } = img;
      let newSrc = decodeURIComponent(src);
      if (!newSrc.includes('fill=')) {
        newSrc = newSrc.replace('<path ', '<path fill="#333" ');
      }
      newSrc = newSrc.replace(`${imagePrefix},`, '').replace(/#[\w]{3,6}/g, color);

      img.src = `${imagePrefix},${encodeURIComponent(newSrc)}`;
      img.onload = () => {
        img.onload = () => {};
        canvas.renderAll();
      };
    }
  };

  checkImageCanBeColored = (img: HTMLImageElement) => {
    if (img?.src?.startsWith('http:') || img?.src?.startsWith('https:')) {
      if (img.src.includes('.svg')) {
        return true;
      }
    }

    return img?.src?.startsWith(imagePrefix);
  };

  changeTextOrShapeColor = (color: string) => {
    const { getSelectedType, getSelected, changeStyle, changeShapeFillColor } = this;
    const type = getSelectedType(getSelected());
    if (type === 'i-text' || type === 'rect') {
      changeStyle({ fill: color });
    } else {
      changeShapeFillColor(color);
    }
  };

  // make the elements as a group
  markGroup = () => {
    const { canvas } = this;
    const active = canvas.getActiveObject();
    if (active?._objects?.length > 1) {
      active.toGroup();
      active.id = getRandString();
    }
  };

  // ungroup the selected group element
  ungroup = () => {
    const { canvas } = this;
    const active = canvas.getActiveObject();
    if (active?.type === 'group') {
      active.toActiveSelection();
    }
  };

  // select element by id
  selectById = (id: string) => {
    const { canvas } = this;
    const objs = canvas.getObjects();
    const item = objs.find((obj: any) => obj.id === id);

    if (item) {
      canvas.setActiveObject(item);
      canvas.renderAll();
    }
  };

  // set element not selectable
  noSelect = () => {
    const { canvas } = this;
    const active = canvas.getActiveObject();
    if (active) {
      active.set('selectable', false);
    }
  };

  // check the element is selectable
  canSelect = () => {
    const { canvas } = this;
    const active = canvas.getActiveObject();
    if (active) {
      active.set('selectable', true);
    }
  };

  // update selected element props
  updateProps = (key: string, value: string | number | boolean) => {
    const { canvas } = this;
    const active = canvas.getActiveObject();
    if (active) {
      active.set(key, value);
      canvas.renderAll();
    }
  };

  // change layer zIndex
  moveDirOfZ = (dir: '-1' | '+1' | 'top' | 'bottom') => {
    const { canvas } = this;
    const active = canvas.getActiveObject();

    if (active && canvas && canvas.bringForward) {
      switch (dir) {
        case '+1':
          canvas.bringForward(active);
          break;
        case 'top':
          canvas.bringToFront(active);
          break;
        case '-1':
          canvas.sendBackwards(active);
          break;
        case 'bottom':
          canvas.sendToBack(active);
          break;
      }
    }
  };

  // remove the selected element
  removeSelected = () => {
    const selected = this.getSelected();

    if (selected) {
      this.canvas.discardActiveObject();
      this.canvas.remove(selected);
    }
  };
}

const api = ApiService.getInstance();
export default api;

// debug
(window as any).ccc = api;
