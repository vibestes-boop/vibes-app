import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { PanResponder } from 'react-native';
import { AdjustSlider } from '../../components/create/editor/AdjustSheet';
beforeEach(() => { jest.spyOn(PanResponder, 'create').mockImplementation(config => ({ panHandlers: { onResponderGrant: config.onPanResponderGrant, onResponderMove: config.onPanResponderMove } } as ReturnType<typeof PanResponder.create>)); });
afterEach(() => jest.restoreAllMocks());
jest.mock('@/lib/i18n',()=>({useI18n:()=>({t:(k:string)=>k})}));
jest.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({bottom:0})}));
jest.mock('@/components/create/editor/sharedStyles',()=>({GlassSheet:({children}:any)=>children,useEditorSheet:()=>({})}));
it('maps the actual track width, clamps endpoints and uses the latest callback on repeated drags',()=>{
 const first=jest.fn(),second=jest.fn();const screen=render(<AdjustSlider label="Saturation" value={0} onChange={first}/>);
 const slider=screen.getByRole('adjustable');
 fireEvent(slider,'layout',{nativeEvent:{layout:{width:200}}});
 fireEvent(slider,'responderGrant',{nativeEvent:{locationX:100}},{x0:100,moveX:100,dx:0,dy:0});
 expect(first).toHaveBeenLastCalledWith(0);
 fireEvent(slider,'responderMove',{nativeEvent:{locationX:150}},{dx:50,dy:0,moveX:150,moveY:0});
 expect(first).toHaveBeenLastCalledWith(25);
 screen.rerender(<AdjustSlider label="Saturation" value={25} onChange={second}/>);
 fireEvent(screen.getByRole('adjustable'),'responderGrant',{nativeEvent:{locationX:0}},{x0:0,moveX:0,dx:0,dy:0});
 expect(second).toHaveBeenLastCalledWith(-50);
 fireEvent(screen.getByRole('adjustable'),'responderMove',{nativeEvent:{locationX:250}},{dx:250,dy:0,moveX:250,moveY:0});
 expect(second).toHaveBeenLastCalledWith(50);
});
it('supports screen-reader adjustment within its bounds',()=>{
 const change=jest.fn();const screen=render(<AdjustSlider label="Brightness" value={48} onChange={change}/>);
 fireEvent(screen.getByRole('adjustable'),'accessibilityAction',{nativeEvent:{actionName:'increment'}});expect(change).toHaveBeenCalledWith(50);
});
