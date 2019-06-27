/*
 * Copyright (c) 1997, 2008, Oracle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 only, as
 * published by the Free Software Foundation.  Oracle designates this
 * particular file as subject to the "Classpath" exception as provided
 * by Oracle in the LICENSE file that accompanied this code.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * version 2 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 2 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact Oracle, 500 Oracle Parkway, Redwood Shores, CA 94065 USA
 * or visit www.oracle.com if you need additional information or have any
 * questions.
 */


/*
 * The Original Code is HAT. The Initial Developer of the
 * Original Code is Bill Foote, with contributions from others
 * at JavaSoft/Sun.
 */

package com.sun.tools.hat.gkinternal.server;

import com.google.common.collect.Multimap;
import com.google.common.collect.Multimaps;
import com.google.common.collect.Ordering;
import com.sun.tools.hat.gkinternal.model.*;

/**
 *
 * @author      Bill Foote
 */


class RootsQuery extends QueryHandler {
    private final boolean includeWeak;

    public RootsQuery(boolean includeWeak) {
        this.includeWeak = includeWeak;
    }

    @Override
    public void run() {
        long id = parseHex(query);
        JavaHeapObject target = snapshot.findThing(id);
        if (target == null) {
            startHtml("Object not found for rootset");
            error("object not found: %#x", id);
            endHtml();
            return;
        }
        if (includeWeak) {
            startHtml("Rootset references to %s (includes weak refs)", target);
        } else {
            startHtml("Rootset references to %s (excludes weak refs)", target);
        }
        out.flush();

        out.print("<h1>References to ");
        printThing(target);
        out.println("</h1>");
        // More interesting values are *higher*
        Multimap<Integer, ReferenceChain> refs = Multimaps.index(
                snapshot.rootsetReferencesTo(target, includeWeak),
                chain -> chain.getObj().getRoot().getType());
        refs.asMap().entrySet().stream().sorted(Ordering.natural().reverse()
                .onResultOf(entry -> entry.getKey())).forEach(entry -> {
            out.print("<h2>");
            print(Root.getTypeName(entry.getKey()) + " References");
            out.println("</h2>");
            entry.getValue().stream().sorted(Ordering.natural()
                    .onResultOf(ReferenceChain::getDepth)).forEach(ref -> {
                Root root = ref.getObj().getRoot();
                out.print("<h3>");
                printRoot(root);
                if (root.getReferer() != null) {
                    out.print("<small> (from ");
                    printThingAnchorTag(root.getReferer().getId());
                    print(root.getReferer().toString());
                    out.print(")</a></small>");

                }
                out.print(" :</h3>");
                while (ref != null) {
                    ReferenceChain next = ref.getNext();
                    JavaHeapObject obj = ref.getObj();
                    print("--> ");
                    printThing(obj);
                    if (next != null) {
                        print(" (" +
                                obj.describeReferenceTo(next.getObj(), snapshot)
                                + ":)");
                    }
                    out.println("<br>");
                    ref = next;
                }
            });
        });

        out.println("<h2>Other queries</h2>");

        if (includeWeak) {
            printAnchorStart();
            out.print("roots/");
            printHex(id);
            out.print("\">");
            out.println("Exclude weak refs</a><br>");
            endHtml();
        }

        if (!includeWeak) {
            printAnchorStart();
            out.print("allRoots/");
            printHex(id);
            out.print("\">");
            out.println("Include weak refs</a><br>");
        }
    }

}
