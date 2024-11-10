# Description:
#   pdfjs, an implementation of a PDF renderer in javascript.

load("//tools/build_defs/license:license.bzl", "license")

licenses(["notice"])

package(default_applicable_licenses = [":license"])

exports_files(["LICENSE"])

license(
    name = "license",
    package_name = "pdfjs",
)

filegroup(
    name = "bcmaps",
    srcs = glob(["*"]),
    visibility = ["//science_search/reader:__subpackages__"],
)
