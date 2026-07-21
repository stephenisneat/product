import type { ReactElement } from "react";
import {
  HugeiconsIcon,
  type HugeiconsIconProps,
  type IconSvgElement,
} from "@hugeicons/react";
import {
  Add01Icon,
  Alert02Icon,
  Analytics01Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowTurnBackwardIcon,
  ArrowUp01Icon,
  ArrowUpDownIcon as ArrowUpDownSolidIcon,
  AttachmentIcon,
  BarChartIcon,
  Briefcase01Icon,
  Building02Icon,
  Calendar03Icon,
  Cancel01Icon,
  CancelCircleIcon,
  ChartLineData01Icon,
  CheckListIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  ComputerIcon,
  Copy01Icon,
  CreditCardIcon as CreditCardSolidIcon,
  Edit02Icon,
  FilterIcon,
  File02Icon,
  GitBranchIcon as GitBranchSolidIcon,
  GitCompareIcon,
  Globe02Icon,
  Idea01Icon,
  ImageAdd02Icon,
  InformationCircleIcon,
  LayoutThreeColumnIcon,
  LifebuoyIcon as LifebuoySolidIcon,
  Link02Icon,
  Loading03Icon,
  Moon02Icon,
  MoreHorizontalIcon,
  Notification01Icon,
  PackageIcon as PackageSolidIcon,
  PaintBoardIcon,
  Pen01Icon,
  PinIcon as PinSolidIcon,
  PuzzleIcon as PuzzleSolidIcon,
  RefreshIcon,
  Search01Icon,
  SecurityIcon,
  SentIcon,
  Settings01Icon,
  ShoppingBag01Icon,
  SmartPhone01Icon,
  SourceCodeIcon,
  SparklesIcon as SparklesSolidIcon,
  SquareLock02Icon,
  SquareUnlock02Icon,
  Store01Icon,
  Sun03Icon,
  TableIcon as TableSolidIcon,
  Tick02Icon,
  Undo03Icon,
  UnfoldMoreIcon,
  UserGroupIcon,
  UserIcon as UserSolidIcon,
  Wallet01Icon,
} from "@hugeicons-pro/core-solid-rounded";

export type IconProps = Omit<HugeiconsIconProps, "icon">;

export type IconComponent = (props: IconProps) => ReactElement;

function createIcon(icon: IconSvgElement): IconComponent {
  function Icon({
    className,
    size = "1em",
    color = "currentColor",
    ...props
  }: IconProps) {
    return (
      <HugeiconsIcon
        icon={icon}
        size={size}
        color={color}
        className={className}
        {...props}
      />
    );
  }
  return Icon;
}

export const ArrowDownIcon = createIcon(ArrowDown01Icon);
export const ArrowLeft = createIcon(ArrowLeft01Icon);
export const ArrowLeftIcon = ArrowLeft;
export const ArrowRight = createIcon(ArrowRight01Icon);
export const ArrowUpDownIcon = createIcon(ArrowUpDownSolidIcon);
export const BarChart3Icon = createIcon(BarChartIcon);
export const BellIcon = createIcon(Notification01Icon);
export const BriefcaseIcon = createIcon(Briefcase01Icon);
export const Building2Icon = createIcon(Building02Icon);
export const CalendarDaysIcon = createIcon(Calendar03Icon);
export const ChartLineIcon = createIcon(ChartLineData01Icon);
export const ChartNoAxesCombinedIcon = createIcon(Analytics01Icon);
export const Check = createIcon(Tick02Icon);
export const CheckIcon = Check;
export const ChevronDownIcon = createIcon(ArrowDown01Icon);
export const ChevronRightIcon = createIcon(ArrowRight01Icon);
export const ChevronUpIcon = createIcon(ArrowUp01Icon);
export const ChevronsUpDown = createIcon(UnfoldMoreIcon);
export const ChevronsUpDownIcon = ChevronsUpDown;
export const CircleAlertIcon = createIcon(Alert02Icon);
export const CircleCheckIcon = createIcon(CheckmarkCircle02Icon);
export const Code2Icon = createIcon(SourceCodeIcon);
export const Columns3Icon = createIcon(LayoutThreeColumnIcon);
export const CopyIcon = createIcon(Copy01Icon);
export const CornerDownLeft = createIcon(ArrowTurnBackwardIcon);
export const CreditCardIcon = createIcon(CreditCardSolidIcon);
export const Ellipsis = createIcon(MoreHorizontalIcon);
export const FileTextIcon = createIcon(File02Icon);
export const GitBranchIcon = createIcon(GitBranchSolidIcon);
export const GitCompareArrowsIcon = createIcon(GitCompareIcon);
export const GlobeIcon = createIcon(Globe02Icon);
export const History = createIcon(Clock01Icon);
export const ImagePlusIcon = createIcon(ImageAdd02Icon);
export const InfoIcon = createIcon(InformationCircleIcon);
export const LightbulbIcon = createIcon(Idea01Icon);
export const LifebuoyIcon = createIcon(LifebuoySolidIcon);
export const Link2Icon = createIcon(Link02Icon);
export const ListFilterIcon = createIcon(FilterIcon);
export const Loader2 = createIcon(Loading03Icon);
export const Loader2Icon = Loader2;
export const LockIcon = createIcon(SquareLock02Icon);
export const LockOpenIcon = createIcon(SquareUnlock02Icon);
export const MonitorIcon = createIcon(ComputerIcon);
export const MoonIcon = createIcon(Moon02Icon);
export const OctagonXIcon = createIcon(CancelCircleIcon);
export const PackageIcon = createIcon(PackageSolidIcon);
export const PaletteIcon = createIcon(PaintBoardIcon);
export const Paperclip = createIcon(AttachmentIcon);
export const PenLineIcon = createIcon(Pen01Icon);
export const Pin = createIcon(PinSolidIcon);
export const Plus = createIcon(Add01Icon);
export const PlusIcon = Plus;
export const PuzzleIcon = createIcon(PuzzleSolidIcon);
export const RefreshCwIcon = createIcon(RefreshIcon);
export const RotateCcwIcon = createIcon(Undo03Icon);
export const Search = createIcon(Search01Icon);
export const SearchIcon = Search;
export const Send = createIcon(SentIcon);
export const SettingsIcon = createIcon(Settings01Icon);
export const ShieldIcon = createIcon(SecurityIcon);
export const ShoppingBagIcon = createIcon(ShoppingBag01Icon);
export const SmartphoneIcon = createIcon(SmartPhone01Icon);
export const SparklesIcon = createIcon(SparklesSolidIcon);
export const SquarePen = createIcon(Edit02Icon);
export const StoreIcon = createIcon(Store01Icon);
export const SunIcon = createIcon(Sun03Icon);
export const TableIcon = createIcon(TableSolidIcon);
export const TriangleAlertIcon = createIcon(Alert02Icon);
export const UserIcon = createIcon(UserSolidIcon);
export const UsersIcon = createIcon(UserGroupIcon);
export const VoteIcon = createIcon(CheckListIcon);
export const WalletIcon = createIcon(Wallet01Icon);
export const X = createIcon(Cancel01Icon);
export const XIcon = X;
