/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';
import CreatePostScreen from '../../app/create';
const mockPush=jest.fn(), mockUpload=jest.fn(), mockInsert=jest.fn(), mockCapture=jest.fn();
const mockRouter={push:mockPush,back:jest.fn()};
let mockMediaType='image';
jest.mock('expo-router',()=>({useRouter:()=>mockRouter,useLocalSearchParams:()=>({mediaUri:'file:///original.jpg',mediaType:mockMediaType})}));
jest.mock('@/lib/authStore',()=>({useAuthStore:()=>({profile:{id:'user'}})}));
jest.mock('@/lib/i18n',()=>({useI18n:()=>({t:(k:string)=>k})}));
jest.mock('@/lib/skiaLoader',()=>({SKIA_READY:false}));
jest.mock('@/lib/useThemedStatusBar',()=>({useThemedStatusBar:()=>{}}));
jest.mock('@/lib/useModerate',()=>({useModerateImage:()=>({moderate:jest.fn()})}));
jest.mock('@/lib/useDrafts',()=>({useDrafts:()=>({saveDraft:jest.fn()})}));
jest.mock('@/lib/usePostDraftsCloud',()=>({usePostDraftsCloud:()=>({saveDraft:jest.fn(),fetchDraft:jest.fn(),deleteDraft:jest.fn()})}));
jest.mock('@/lib/useScheduledPosts',()=>({useScheduledPosts:()=>({schedulePost:jest.fn()})}));
jest.mock('@/lib/useShop',()=>({useMyProducts:()=>({data:[]})}));
jest.mock('@/lib/useMusicPicker',()=>({MUSIC_LIBRARY:[]}));
jest.mock('@/lib/supabase',()=>({supabase:{from:()=>({insert:mockInsert})}}));
jest.mock('@/lib/uploadMedia',()=>({uploadPostMedia:(...a:any[])=>mockUpload(...a),generateAndUploadThumbnail:jest.fn()}));
jest.mock('@/lib/bakeImageEdits',()=>({bakeImageEdits:jest.fn()}));
jest.mock('@tanstack/react-query',()=>({useQueryClient:()=>({invalidateQueries:jest.fn()})}));
const mockVideoPlayer={play:jest.fn(),pause:jest.fn()};
jest.mock('expo-video',()=>({useVideoPlayer:()=>mockVideoPlayer,VideoView:()=>null}));
jest.mock('@react-navigation/native',()=>({useIsFocused:()=>true}));
jest.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0,left:0,right:0})}));
jest.mock('@/components/ai/AIImageSheet',()=>({AIImageSheet:()=>null}));
jest.mock('@/components/camera/MusicPickerSheet',()=>({MusicPickerSheet:()=>null}));
jest.mock('@/components/create',()=>({CreateProgressBar:()=>null}));
jest.mock('react-native-view-shot',()=>{
 const React=require('react'),{View}=require('react-native');
 return React.forwardRef(function Shot({children,...props}:any,ref:any){React.useImperativeHandle(ref,()=>({capture:mockCapture}));return React.createElement(View,props,children);});
});
jest.mock('@/components/create/editor',()=>{
 const React=require('react'),{Pressable,Text}=require('react-native');
 const button=(label:string,onPress:()=>void)=>React.createElement(Pressable,{onPress,accessibilityRole:'button',accessibilityLabel:label},React.createElement(Text,null,label));
 const empty=()=>null;
 return {SW:390,SH:844,AdjustSheet:empty,CoverPickerSheet:empty,CropSheet:empty,DrawCanvas:empty,DrawToolbar:empty,PostSuccessOverlay:empty,RotateSheet:empty,SchedulerModal:empty,SkiaFilteredImage:empty,StickerOverlayItem:empty,StickerSheet:empty,TextOverlayEditor:empty,TextOverlayItem:empty,TrashZone:empty,isInTrash:()=>false,
  FilterSheet:({visible,onSelect}:any)=>visible?button('select-warm',()=>onSelect('warm')):null,
  DetailsSheet:({visible}:any)=>visible?React.createElement(Text,null,'details-open'):null,
 };
});
beforeEach(()=>{jest.clearAllMocks();mockMediaType='image';jest.spyOn(Alert,'alert').mockImplementation(()=>{});});
afterEach(()=>{jest.useRealTimers();jest.restoreAllMocks();});
it('opens the story review without uploading or inserting a feed post',async()=>{
 const screen=render(<CreatePostScreen/>);
 await act(async()=>{fireEvent.press(screen.getByLabelText('editorUx.storyPreview'));});
 expect(mockPush).toHaveBeenCalledWith({pathname:'/create-story',params:{mediaUri:'file:///original.jpg',mediaType:'image',mediaMimeType:'image/jpeg'}});
 expect(mockUpload).not.toHaveBeenCalled();expect(mockInsert).not.toHaveBeenCalled();
});
it('keeps Continue as a review step and offers only one sound entry',()=>{
 const screen=render(<CreatePostScreen/>);fireEvent.press(screen.getByLabelText('editorUx.postDetails'));
 expect(screen.getByText('details-open')).toBeTruthy();expect(screen.getAllByLabelText('create.addSound')).toHaveLength(1);expect(screen.queryByText('create.sound')).toBeNull();expect(mockInsert).not.toHaveBeenCalled();
});
it('never silently forwards the unedited image if capturing edits fails',async()=>{
 jest.useFakeTimers();mockCapture.mockResolvedValue(null);const screen=render(<CreatePostScreen/>);
 fireEvent.press(screen.getByLabelText('create.filter'));fireEvent.press(screen.getByLabelText('select-warm'));fireEvent.press(screen.getByLabelText('editorUx.storyPreview'));
 await act(async()=>{await jest.advanceTimersByTimeAsync(200);});
 expect(Alert.alert).toHaveBeenCalledWith('create.tooBad','editorUx.exportFailed');expect(mockPush).not.toHaveBeenCalled();expect(mockUpload).not.toHaveBeenCalled();
});
it('passes the composited photo to the story review and suppresses repeated taps',async()=>{
 jest.useFakeTimers();mockCapture.mockResolvedValue('/edited.jpg');const screen=render(<CreatePostScreen/>);
 fireEvent.press(screen.getByLabelText('create.filter'));fireEvent.press(screen.getByLabelText('select-warm'));
 const story=screen.getByLabelText('editorUx.storyPreview');fireEvent.press(story);fireEvent.press(story);
 await act(async()=>{await jest.advanceTimersByTimeAsync(200);});
 expect(mockCapture).toHaveBeenCalledTimes(1);expect(mockPush).toHaveBeenCalledTimes(1);expect(mockPush.mock.calls[0][0].params.mediaUri).toBe('file:///edited.jpg');expect(mockInsert).not.toHaveBeenCalled();
});
it('does not offer photo edits or a trim operation that cannot be exported for video',()=>{
 mockMediaType='video';const screen=render(<CreatePostScreen/>);
 expect(screen.getByLabelText('create.cover')).toBeTruthy();expect(screen.queryByLabelText('create.adjust')).toBeNull();expect(screen.queryByLabelText('create.trim')).toBeNull();
});
