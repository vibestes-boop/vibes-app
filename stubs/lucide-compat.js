/**
 * lucide-react-native stub
 *
 * Problem: lucide-react-native verwendet TypeScript barrel exports mit
 * Object.freeze() auf dem Default-Export-Objekt. Metro's _interopNamespace()
 * versucht n.default = e zu setzen → TypeError bei non-configurable getter.
 *
 * Fix: Stub rendert Icons als Unicode-Symbole (Text) statt unsichtbaren Views.
 * So sind alle Icons sichtbar und klickbar, ohne das native SVG-Modul zu laden.
 */
'use strict';

var React = require('react');
var RN = require('react-native');

// Unicode-Mapping: Icon-Name → passendes Symbol
var ICON_SYMBOLS = {
  Zap:              '⚡',
  Users:            '👥',
  MessageCircle:    '💬',
  User:             '👤',
  Plus:             '+',
  Heart:            '♥',
  Share:            '↗',
  Share2:           '↗',
  Bookmark:         '🔖',
  X:                '✕',
  ChevronLeft:      '‹',
  ChevronRight:     '›',
  ChevronDown:      '∨',
  ChevronUp:        '∧',
  Search:           '🔍',
  Bell:             '🔔',
  Settings:         '⚙',
  Camera:           '📷',
  CameraOff:        '📷',
  Video:            '▶',
  Play:             '▶',
  Pause:            '⏸',
  Volume2:          '🔊',
  VolumeX:          '🔇',
  Send:             '➤',
  Image:            '🖼',
  ImagePlus:        '🖼',
  Trash2:           '🗑',
  Edit2:            '✏',
  Edit3:            '✏',
  Eye:              '👁',
  EyeOff:           '👁',
  Lock:             '🔒',
  Unlock:           '🔓',
  Mail:             '✉',
  Phone:            '📞',
  Map:              '🗺',
  MapPin:           '📍',
  Star:             '★',
  Flag:             '⚑',
  Globe:            '🌐',
  Link:             '🔗',
  Upload:           '↑',
  Download:         '↓',
  RefreshCw:        '↻',
  Check:            '✓',
  CheckCircle:      '✓',
  CheckCircle2:     '✓',
  CheckCheck:       '✓✓',
  Circle:           '○',
  AlertCircle:      '⚠',
  Info:             'ℹ',
  Mic:              '🎙',
  MicOff:           '🎙',
  ArrowLeft:        '←',
  ArrowRight:       '→',
  ArrowUp:          '↑',
  ArrowDown:        '↓',
  Home:             '⌂',
  LogOut:           '→|',
  LogIn:            '|→',
  Radio:            '📡',
  Wifi:             '📶',
  WifiOff:          '📵',
  MoreVertical:     '⋮',
  MoreHorizontal:   '⋯',
  Loader:           '⟳',
  Filter:           '⊟',
  Sliders:          '⚙',
  SlidersHorizontal:'⚙',
  MessageSquare:    '💬',
  ThumbsUp:         '👍',
  ThumbsDown:       '👎',
  Copy:             '⎘',
  ExternalLink:     '↗',
  Activity:         '⚡',
  Tv:               '📺',
  Maximize2:        '⤢',
  Minimize2:        '⤡',
  RotateCcw:        '↺',
  RotateCw:         '↻',
  Vibrate:          '📳',
  Smartphone:       '📱',
  Sparkles:         '✨',
  Flame:            '🔥',
  Clock:            '🕐',
  Timer:            '⏱',
  Trophy:           '🏆',
  Brain:            '🧠',
  TrendingUp:       '↗',
  TrendingDown:     '↘',
  UserPlus:         '👤+',
  UserCheck:        '✓',
  UserCircle:       '👤',
  PlusCircle:       '+',
  Grid3X3:          '⊞',
  Shield:           '🛡',
  Rss:              '📡',
  Tag:              '🏷',
  Pencil:           '✏',
  PenSquare:        '✏',
  AtSign:           '@',
  FileText:         '📄',
  Compass:          '🧭',
  BookOpen:         '📖',
};

// Generischer Icon: rendert das Unicode-Symbol als Text
function makeIcon(name, symbol) {
  var IconComponent = function(props) {
    var size = props.size || 24;
    var color = props.color || props.stroke || '#ccc';
    var sym = symbol || '●';
    // fill prop: manche Icons nutzen fill für ausgefüllte Herzen etc.
    var finalColor = props.fill && props.fill !== 'none' && props.fill !== 'transparent'
      ? props.fill
      : color;
    return React.createElement(RN.View, {
      style: {
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      },
      accessibilityLabel: name,
    }, React.createElement(RN.Text, {
      style: {
        fontSize: size * 0.72,
        color: finalColor,
        lineHeight: size,
        textAlign: 'center',
        includeFontPadding: false,
      },
      numberOfLines: 1,
      allowFontScaling: false,
    }, sym));
  };
  IconComponent.displayName = name;
  return IconComponent;
}

// Alle Icons mit ihren Unicode-Symbolen instanziieren
var Zap           = makeIcon('Zap',            ICON_SYMBOLS.Zap);
var Users         = makeIcon('Users',          ICON_SYMBOLS.Users);
var MessageCircle = makeIcon('MessageCircle',  ICON_SYMBOLS.MessageCircle);
var User          = makeIcon('User',           ICON_SYMBOLS.User);
var Plus          = makeIcon('Plus',           ICON_SYMBOLS.Plus);
var Heart         = makeIcon('Heart',          ICON_SYMBOLS.Heart);
var Share         = makeIcon('Share',          ICON_SYMBOLS.Share);
var Share2        = makeIcon('Share2',         ICON_SYMBOLS.Share2);
var Bookmark      = makeIcon('Bookmark',       ICON_SYMBOLS.Bookmark);
var X             = makeIcon('X',              ICON_SYMBOLS.X);
var ChevronLeft   = makeIcon('ChevronLeft',    ICON_SYMBOLS.ChevronLeft);
var ChevronRight  = makeIcon('ChevronRight',   ICON_SYMBOLS.ChevronRight);
var ChevronDown   = makeIcon('ChevronDown',    ICON_SYMBOLS.ChevronDown);
var ChevronUp     = makeIcon('ChevronUp',      ICON_SYMBOLS.ChevronUp);
var Search        = makeIcon('Search',         ICON_SYMBOLS.Search);
var Bell          = makeIcon('Bell',           ICON_SYMBOLS.Bell);
var Settings      = makeIcon('Settings',       ICON_SYMBOLS.Settings);
var Camera        = makeIcon('Camera',         ICON_SYMBOLS.Camera);
var CameraOff     = makeIcon('CameraOff',      ICON_SYMBOLS.CameraOff);
var Video         = makeIcon('Video',          ICON_SYMBOLS.Video);
var Play          = makeIcon('Play',           ICON_SYMBOLS.Play);
var Pause         = makeIcon('Pause',          ICON_SYMBOLS.Pause);
var Volume2       = makeIcon('Volume2',        ICON_SYMBOLS.Volume2);
var VolumeX       = makeIcon('VolumeX',        ICON_SYMBOLS.VolumeX);
var Send          = makeIcon('Send',           ICON_SYMBOLS.Send);
var Image         = makeIcon('Image',          ICON_SYMBOLS.Image);
var ImagePlus     = makeIcon('ImagePlus',      ICON_SYMBOLS.ImagePlus);
var Trash2        = makeIcon('Trash2',         ICON_SYMBOLS.Trash2);
var Edit2         = makeIcon('Edit2',          ICON_SYMBOLS.Edit2);
var Edit3         = makeIcon('Edit3',          ICON_SYMBOLS.Edit3);
var Eye           = makeIcon('Eye',            ICON_SYMBOLS.Eye);
var EyeOff        = makeIcon('EyeOff',         ICON_SYMBOLS.EyeOff);
var Lock          = makeIcon('Lock',           ICON_SYMBOLS.Lock);
var Unlock        = makeIcon('Unlock',         ICON_SYMBOLS.Unlock);
var Mail          = makeIcon('Mail',           ICON_SYMBOLS.Mail);
var Phone         = makeIcon('Phone',          ICON_SYMBOLS.Phone);
var Map           = makeIcon('Map',            ICON_SYMBOLS.Map);
var MapPin        = makeIcon('MapPin',         ICON_SYMBOLS.MapPin);
var Star          = makeIcon('Star',           ICON_SYMBOLS.Star);
var Flag          = makeIcon('Flag',           ICON_SYMBOLS.Flag);
var Globe         = makeIcon('Globe',          ICON_SYMBOLS.Globe);
var Link          = makeIcon('Link',           ICON_SYMBOLS.Link);
var Upload        = makeIcon('Upload',         ICON_SYMBOLS.Upload);
var Download      = makeIcon('Download',       ICON_SYMBOLS.Download);
var RefreshCw     = makeIcon('RefreshCw',      ICON_SYMBOLS.RefreshCw);
var Check         = makeIcon('Check',          ICON_SYMBOLS.Check);
var CheckCircle   = makeIcon('CheckCircle',    ICON_SYMBOLS.CheckCircle);
var CheckCircle2  = makeIcon('CheckCircle2',   ICON_SYMBOLS.CheckCircle2);
var CheckCheck    = makeIcon('CheckCheck',     ICON_SYMBOLS.CheckCheck);
var Circle        = makeIcon('Circle',         ICON_SYMBOLS.Circle);
var AlertCircle   = makeIcon('AlertCircle',    ICON_SYMBOLS.AlertCircle);
var Info          = makeIcon('Info',           ICON_SYMBOLS.Info);
var Mic           = makeIcon('Mic',            ICON_SYMBOLS.Mic);
var MicOff        = makeIcon('MicOff',         ICON_SYMBOLS.MicOff);
var ArrowLeft     = makeIcon('ArrowLeft',      ICON_SYMBOLS.ArrowLeft);
var ArrowRight    = makeIcon('ArrowRight',     ICON_SYMBOLS.ArrowRight);
var ArrowUp       = makeIcon('ArrowUp',        ICON_SYMBOLS.ArrowUp);
var ArrowDown     = makeIcon('ArrowDown',      ICON_SYMBOLS.ArrowDown);
var Home          = makeIcon('Home',           ICON_SYMBOLS.Home);
var LogOut        = makeIcon('LogOut',         ICON_SYMBOLS.LogOut);
var LogIn         = makeIcon('LogIn',          ICON_SYMBOLS.LogIn);
var Radio         = makeIcon('Radio',          ICON_SYMBOLS.Radio);
var Wifi          = makeIcon('Wifi',           ICON_SYMBOLS.Wifi);
var WifiOff       = makeIcon('WifiOff',        ICON_SYMBOLS.WifiOff);
var MoreVertical   = makeIcon('MoreVertical',   ICON_SYMBOLS.MoreVertical);
var MoreHorizontal = makeIcon('MoreHorizontal', ICON_SYMBOLS.MoreHorizontal);
var Loader        = makeIcon('Loader',         ICON_SYMBOLS.Loader);
var Filter        = makeIcon('Filter',         ICON_SYMBOLS.Filter);
var Sliders       = makeIcon('Sliders',        ICON_SYMBOLS.Sliders);
var SlidersHorizontal = makeIcon('SlidersHorizontal', ICON_SYMBOLS.SlidersHorizontal);
var MessageSquare = makeIcon('MessageSquare',  ICON_SYMBOLS.MessageSquare);
var ThumbsUp      = makeIcon('ThumbsUp',       ICON_SYMBOLS.ThumbsUp);
var ThumbsDown    = makeIcon('ThumbsDown',     ICON_SYMBOLS.ThumbsDown);
var Copy          = makeIcon('Copy',           ICON_SYMBOLS.Copy);
var ExternalLink  = makeIcon('ExternalLink',   ICON_SYMBOLS.ExternalLink);
var Activity      = makeIcon('Activity',       ICON_SYMBOLS.Activity);
var Tv            = makeIcon('Tv',             ICON_SYMBOLS.Tv);
var Maximize2     = makeIcon('Maximize2',      ICON_SYMBOLS.Maximize2);
var Minimize2     = makeIcon('Minimize2',      ICON_SYMBOLS.Minimize2);
var RotateCcw     = makeIcon('RotateCcw',      ICON_SYMBOLS.RotateCcw);
var RotateCw      = makeIcon('RotateCw',       ICON_SYMBOLS.RotateCw);
var Vibrate       = makeIcon('Vibrate',        ICON_SYMBOLS.Vibrate);
var Smartphone    = makeIcon('Smartphone',     ICON_SYMBOLS.Smartphone);
var Sparkles      = makeIcon('Sparkles',       ICON_SYMBOLS.Sparkles);
var Flame         = makeIcon('Flame',          ICON_SYMBOLS.Flame);
var Clock         = makeIcon('Clock',          ICON_SYMBOLS.Clock);
var Timer         = makeIcon('Timer',          ICON_SYMBOLS.Timer);
var Trophy        = makeIcon('Trophy',         ICON_SYMBOLS.Trophy);
var Brain         = makeIcon('Brain',          ICON_SYMBOLS.Brain);
var TrendingUp    = makeIcon('TrendingUp',     ICON_SYMBOLS.TrendingUp);
var TrendingDown  = makeIcon('TrendingDown',   ICON_SYMBOLS.TrendingDown);
var UserPlus      = makeIcon('UserPlus',       ICON_SYMBOLS.UserPlus);
var UserCheck     = makeIcon('UserCheck',      ICON_SYMBOLS.UserCheck);
var UserCircle    = makeIcon('UserCircle',     ICON_SYMBOLS.UserCircle);
var PlusCircle    = makeIcon('PlusCircle',     ICON_SYMBOLS.PlusCircle);
var Grid3X3       = makeIcon('Grid3X3',        ICON_SYMBOLS.Grid3X3);
var Shield        = makeIcon('Shield',         ICON_SYMBOLS.Shield);
var Rss           = makeIcon('Rss',            ICON_SYMBOLS.Rss);
var Tag           = makeIcon('Tag',            ICON_SYMBOLS.Tag);
var Pencil        = makeIcon('Pencil',         ICON_SYMBOLS.Pencil);
var PenSquare     = makeIcon('PenSquare',      ICON_SYMBOLS.PenSquare);
var AtSign        = makeIcon('AtSign',         ICON_SYMBOLS.AtSign);
var FileText      = makeIcon('FileText',       ICON_SYMBOLS.FileText);
var Compass       = makeIcon('Compass',        ICON_SYMBOLS.Compass);
var BookOpen      = makeIcon('BookOpen',       ICON_SYMBOLS.BookOpen);

module.exports = {
  Zap, Users, MessageCircle, User, Plus, Heart, Share, Share2, Bookmark,
  X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Search, Bell, Settings, Camera, CameraOff, Video, Play, Pause,
  Volume2, VolumeX, Send, Image, ImagePlus, Trash2, Edit2, Edit3,
  Eye, EyeOff, Lock, Unlock, Mail, Phone, Map, MapPin,
  Star, Flag, Globe, Link, Upload, Download, RefreshCw,
  Check, CheckCircle, CheckCircle2, CheckCheck, Circle, AlertCircle, Info, Mic, MicOff,
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Home,
  LogOut, LogIn, Radio, Wifi, WifiOff, MoreVertical, MoreHorizontal,
  Loader, Filter, Sliders, SlidersHorizontal, MessageSquare, ThumbsUp, ThumbsDown,
  Copy, ExternalLink, Activity, Tv, Maximize2, Minimize2,
  RotateCcw, RotateCw, Vibrate, Smartphone,
  Sparkles, Flame, Clock, Timer, Trophy, Brain,
  TrendingUp, TrendingDown, UserPlus, UserCheck, UserCircle,
  PlusCircle, Grid3X3, Shield, Rss, Tag, Pencil, PenSquare,
  AtSign, FileText, Compass, BookOpen,
  // Aliases
  ImageIcon: Image,
  SearchIcon: Search,
};

// KRITISCH: Verhindert Metro _interopNamespace TypeError
module.exports.default = module.exports;

