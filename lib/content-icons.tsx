import {
  BookOpen,
  Briefcase,
  Building,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  Heart,
  Target,
  UserCheck,
  Users,
} from "lucide-react"

export const contentIcons = {
  BookOpen,
  Briefcase,
  Building,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  Heart,
  Target,
  UserCheck,
  Users,
} as const

export function getContentIcon(name: string) {
  return contentIcons[name as keyof typeof contentIcons] ?? CheckCircle
}