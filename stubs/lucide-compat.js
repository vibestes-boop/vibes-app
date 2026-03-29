/**
 * lucide-react-native stub — Hermes-kompatibel für Expo Go
 *
 * Problem: lucide-react-native + Metro _interopNamespace → TypeError in Hermes.
 * Fix: Alle Icons als Unicode-Text rendern, kein Proxy, kein ESM.
 */
'use strict';

var React = require('react');
var RN = require('react-native');

function makeIcon(name, symbol) {
  var IconComponent = function(props) {
    var size = props.size || 24;
    var color = props.color || props.stroke || '#ccc';
    var sym = symbol || '•';
    var finalColor = (props.fill && props.fill !== 'none' && props.fill !== 'transparent')
      ? props.fill : color;
    return React.createElement(RN.View, {
      style: { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
      accessibilityLabel: name,
    }, React.createElement(RN.Text, {
      style: { fontSize: size * 0.72, color: finalColor, lineHeight: size, textAlign: 'center', includeFontPadding: false },
      numberOfLines: 1,
      allowFontScaling: false,
    }, sym));
  };
  IconComponent.displayName = name;
  return IconComponent;
}

var Zap               = makeIcon('Zap',               '⚡');
var Users             = makeIcon('Users',             '👥');
var MessageCircle     = makeIcon('MessageCircle',     '💬');
var MessageSquare     = makeIcon('MessageSquare',     '💬');
var User              = makeIcon('User',              '👤');
var Plus              = makeIcon('Plus',              '+');
var PlusCircle        = makeIcon('PlusCircle',        '+');
var Heart             = makeIcon('Heart',             '♥');
var Share             = makeIcon('Share',             '↗');
var Share2            = makeIcon('Share2',            '↗');
var Bookmark          = makeIcon('Bookmark',          '🔖');
var BookmarkPlus      = makeIcon('BookmarkPlus',      '🔖');
var X                 = makeIcon('X',                '✕');
var ChevronLeft       = makeIcon('ChevronLeft',      '‹');
var ChevronRight      = makeIcon('ChevronRight',     '›');
var ChevronDown       = makeIcon('ChevronDown',      '∨');
var ChevronUp         = makeIcon('ChevronUp',        '∧');
var Search            = makeIcon('Search',           '⌕');
var Bell              = makeIcon('Bell',             '🔔');
var Settings          = makeIcon('Settings',         '⚙');
var SlidersHorizontal = makeIcon('SlidersHorizontal','⚙');
var Sliders           = makeIcon('Sliders',          '⚙');
var Camera            = makeIcon('Camera',           '📷');
var CameraOff         = makeIcon('CameraOff',        '📷');
var Video             = makeIcon('Video',            '▶');
var Play              = makeIcon('Play',             '▶');
var Pause             = makeIcon('Pause',            '⏸');
var Volume2           = makeIcon('Volume2',          '🔊');
var VolumeX           = makeIcon('VolumeX',          '🔇');
var Mic               = makeIcon('Mic',              '🎙');
var Mic2              = makeIcon('Mic2',             '🎙');
var MicOff            = makeIcon('MicOff',           '🎙');
var Send              = makeIcon('Send',             '➤');
var Copy              = makeIcon('Copy',             '⎘');
var Download          = makeIcon('Download',         '↓');
var Upload            = makeIcon('Upload',           '↑');
var ExternalLink      = makeIcon('ExternalLink',     '↗');
var ArrowUpRight      = makeIcon('ArrowUpRight',     '↗');
var Link              = makeIcon('Link',             '🔗');
var Link2             = makeIcon('Link2',            '🔗');
var Image             = makeIcon('Image',            '🖼');
var ImagePlus         = makeIcon('ImagePlus',        '🖼');
var FileText          = makeIcon('FileText',         '📄');
var Trash2            = makeIcon('Trash2',           '🗑');
var Edit2             = makeIcon('Edit2',            '✏');
var Edit3             = makeIcon('Edit3',            '✏');
var Pencil            = makeIcon('Pencil',           '✏');
var PenSquare         = makeIcon('PenSquare',        '✏');
var Eye               = makeIcon('Eye',              '👁');
var EyeOff            = makeIcon('EyeOff',           '🚫');
var Lock              = makeIcon('Lock',             '🔒');
var Unlock            = makeIcon('Unlock',           '🔓');
var Shield            = makeIcon('Shield',           '🛡');
var Flag              = makeIcon('Flag',             '⚑');
var Mail              = makeIcon('Mail',             '✉');
var Phone             = makeIcon('Phone',            '📞');
var Radio             = makeIcon('Radio',            '📡');
var Rss               = makeIcon('Rss',              '📡');
var Antenna           = makeIcon('Antenna',          '📡');
var Map               = makeIcon('Map',              '🗺');
var MapPin            = makeIcon('MapPin',           '📍');
var Globe             = makeIcon('Globe',            '🌐');
var Compass           = makeIcon('Compass',          '🧭');
var Star              = makeIcon('Star',             '★');
var ThumbsUp          = makeIcon('ThumbsUp',         '👍');
var ThumbsDown        = makeIcon('ThumbsDown',       '👎');
var HelpCircle        = makeIcon('HelpCircle',       '?');
var AlertCircle       = makeIcon('AlertCircle',      '⚠');
var Info              = makeIcon('Info',             'ℹ');
var Check             = makeIcon('Check',            '✓');
var CheckCircle       = makeIcon('CheckCircle',      '✓');
var CheckCircle2      = makeIcon('CheckCircle2',     '✓');
var CheckCheck        = makeIcon('CheckCheck',       '✓✓');
var Circle            = makeIcon('Circle',           '○');
var Wifi              = makeIcon('Wifi',             '📶');
var WifiOff           = makeIcon('WifiOff',          '📵');
var ArrowLeft         = makeIcon('ArrowLeft',        '←');
var ArrowRight        = makeIcon('ArrowRight',       '→');
var ArrowUp           = makeIcon('ArrowUp',          '↑');
var ArrowDown         = makeIcon('ArrowDown',        '↓');
var ArrowDownFromLine = makeIcon('ArrowDownFromLine','↓');
var Home              = makeIcon('Home',             '⌂');
var UserPlus          = makeIcon('UserPlus',         '👤+');
var UserCheck         = makeIcon('UserCheck',        '✓');
var UserCircle        = makeIcon('UserCircle',       '👤');
var LogOut            = makeIcon('LogOut',           '→|');
var LogIn             = makeIcon('LogIn',            '|→');
var Brain             = makeIcon('Brain',            '🧠');
var Sparkles          = makeIcon('Sparkles',         '✨');
var Flame             = makeIcon('Flame',            '🔥');
var Activity          = makeIcon('Activity',         '⚡');
var Grid3X3           = makeIcon('Grid3X3',          '⊞');
var MoreVertical      = makeIcon('MoreVertical',     '⋮');
var MoreHorizontal    = makeIcon('MoreHorizontal',   '⋯');
var Clock             = makeIcon('Clock',            '🕐');
var Timer             = makeIcon('Timer',            '⏱');
var Trophy            = makeIcon('Trophy',           '🏆');
var TrendingUp        = makeIcon('TrendingUp',       '↗');
var TrendingDown      = makeIcon('TrendingDown',     '↘');
var Tag               = makeIcon('Tag',              '🏷');
var AtSign            = makeIcon('AtSign',           '@');
var Loader            = makeIcon('Loader',           '⟳');
var Filter            = makeIcon('Filter',           '⊟');
var RefreshCw         = makeIcon('RefreshCw',        '↻');
var RefreshCcw        = makeIcon('RefreshCcw',       '↺');
var RotateCcw         = makeIcon('RotateCcw',        '↺');
var RotateCw          = makeIcon('RotateCw',         '↻');
var Smartphone        = makeIcon('Smartphone',       '📱');
var Vibrate           = makeIcon('Vibrate',          '📳');
var Tv                = makeIcon('Tv',               '📺');
var Maximize2         = makeIcon('Maximize2',        '⤢');
var Minimize2         = makeIcon('Minimize2',        '⤡');
var BookOpen          = makeIcon('BookOpen',         '📖');
var QrCode            = makeIcon('QrCode',           '▦');

module.exports = {
  Zap, Users, MessageCircle, MessageSquare, User, Plus, PlusCircle,
  Heart, Share, Share2, Bookmark, BookmarkPlus, X,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Search, Bell, Settings, SlidersHorizontal, Sliders,
  Camera, CameraOff, Video, Play, Pause, Volume2, VolumeX,
  Mic, Mic2, MicOff, Send, Copy, Download, Upload,
  ExternalLink, ArrowUpRight, Link, Link2,
  Image, ImagePlus, FileText,
  Trash2, Edit2, Edit3, Pencil, PenSquare,
  Eye, EyeOff, Lock, Unlock, Shield, Flag,
  Mail, Phone, Radio, Rss, Antenna,
  Map, MapPin, Globe, Compass,
  Star, ThumbsUp, ThumbsDown, HelpCircle, AlertCircle, Info,
  Check, CheckCircle, CheckCircle2, CheckCheck, Circle,
  Wifi, WifiOff,
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown, ArrowDownFromLine, Home,
  UserPlus, UserCheck, UserCircle, LogOut, LogIn,
  Brain, Sparkles, Flame, Activity,
  Grid3X3, MoreVertical, MoreHorizontal,
  Clock, Timer, Trophy, TrendingUp, TrendingDown,
  Tag, AtSign, Loader, Filter,
  RefreshCw, RefreshCcw, RotateCcw, RotateCw,
  Smartphone, Vibrate, Tv, Maximize2, Minimize2,
  BookOpen, QrCode,
  // Aliases
  ImageIcon: Image,
  SearchIcon: Search,
};

module.exports.default = module.exports;
